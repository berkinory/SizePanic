import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract } from "tar";

import { MAX_EXTRACTED_SIZE } from "../constants";

export async function extractTarball(
  tarball: Buffer,
  jobDir: string
): Promise<string> {
  const extractDir = join(tmpdir(), jobDir);
  await mkdir(extractDir, { recursive: true });

  const tarballPath = join(extractDir, "package.tgz");
  await Bun.write(tarballPath, tarball);

  await extract({
    cwd: extractDir,
    file: tarballPath,
  });

  await rm(tarballPath);

  const packageDir = join(extractDir, "package");
  const stat = await getDirectorySize(packageDir);

  if (stat > MAX_EXTRACTED_SIZE) {
    await rm(extractDir, { recursive: true, force: true });
    throw new Error(
      `Extracted size ${stat} exceeds limit ${MAX_EXTRACTED_SIZE}`
    );
  }

  return packageDir;
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
