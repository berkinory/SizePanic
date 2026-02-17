import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InstallError, SizeLimitError } from "./errors";

const VERSION_NOT_FOUND =
  /No version matching "(.+)" found for specifier "(.+)"/;
const PACKAGE_NOT_FOUND = /GET .+ - 404/;

function parseInstallError(stderr: string): string {
  const versionMatch = stderr.match(VERSION_NOT_FOUND);
  if (versionMatch) {
    return `No version of "${versionMatch[2]}" satisfies "${versionMatch[1]}"`;
  }

  if (PACKAGE_NOT_FOUND.test(stderr)) {
    const nameMatch = stderr.match(/error: (.+?) failed to resolve/);
    const pkg = nameMatch ? nameMatch[1] : "unknown";
    return `Package "${pkg}" not found on npm`;
  }

  return `Install failed: ${stderr.slice(0, 300)}`;
}

const INSTALL_TIMEOUT = 30_000;
const MAX_INSTALL_SIZE = 150 * 1024 * 1024;

interface InstallResult {
  workDir: string;
  peerDeps: string[];
}

export async function installPackage(
  packageName: string,
  version: string,
  jobId: string
): Promise<InstallResult> {
  const workDir = join(tmpdir(), `job-${jobId}`);
  await mkdir(workDir, { recursive: true });

  await Bun.write(
    join(workDir, "package.json"),
    JSON.stringify({ dependencies: { [packageName]: version } })
  );

  await runBunInstall(workDir);

  const totalSize = await getDirectorySize(join(workDir, "node_modules"));
  if (totalSize > MAX_INSTALL_SIZE) {
    throw new SizeLimitError(
      "Package exceeds the maximum allowed install size"
    );
  }

  const peerDeps = await readPeerDependencies(workDir, packageName);

  return { workDir, peerDeps };
}

function runBunInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "bun",
      [
        "install",
        "--production",
        "--ignore-scripts",
        "--omit=peer",
        "--omit=optional",
        "--no-save",
      ],
      {
        cwd,
        stdio: ["ignore", "ignore", "pipe"],
      }
    );

    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, INSTALL_TIMEOUT);

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(new InstallError("Package installation timed out"));
        return;
      }

      if (code !== 0) {
        reject(new InstallError(parseInstallError(stderr)));
        return;
      }

      resolve();
    });
  });
}

async function readPeerDependencies(
  workDir: string,
  packageName: string
): Promise<string[]> {
  const pkgJsonPath = join(
    workDir,
    "node_modules",
    packageName,
    "package.json"
  );
  const file = Bun.file(pkgJsonPath);

  if (!(await file.exists())) return [];

  const pkg = (await file.json()) as {
    peerDependencies?: Record<string, string>;
  };

  return Object.keys(pkg.peerDependencies || {});
}

async function getDirectorySize(dir: string): Promise<number> {
  const glob = new Bun.Glob("**/*");
  let totalSize = 0;

  for await (const path of glob.scan({ cwd: dir })) {
    const file = Bun.file(join(dir, path));
    totalSize += file.size;
  }

  return totalSize;
}
