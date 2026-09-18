import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cleanup } from "./cleanup";
import { getDirectorySize, installPackage } from "./installer";

test("installer cache is job-owned and removed with successful jobs", async () => {
  const jobId = `test-${crypto.randomUUID()}`;
  const path = join(tmpdir(), `job-${jobId}`);
  try {
    const result = await installPackage("clsx", "2.1.1", jobId);
    expect(result.workDir).toBe(path);
    expect(existsSync(join(path, "node_modules", "clsx", "package.json"))).toBe(
      true
    );
    expect(existsSync(join(path, "cache"))).toBe(true);
  } finally {
    await cleanup(jobId);
  }
  expect(existsSync(path)).toBe(false);
}, 40_000);

test("failed installs also leave only job-owned files that cleanup removes", async () => {
  const jobId = `test-${crypto.randomUUID()}`;
  const path = join(tmpdir(), `job-${jobId}`);
  try {
    await expect(installPackage("clsx", "99999.0.0", jobId)).rejects.toThrow();
  } finally {
    await cleanup(jobId);
  }
  expect(existsSync(path)).toBe(false);
}, 40_000);

test("stops an installer that exceeds its temporary storage budget", async () => {
  const { mkdtemp, mkdir, rm, chmod } = await import("node:fs/promises");
  const fakeBin = await mkdtemp(join(tmpdir(), "installer-test-bin-"));
  const executable = join(fakeBin, "bun");
  const previousPath = process.env.PATH;
  const jobId = `test-${crypto.randomUUID()}`;
  const path = join(tmpdir(), `job-${jobId}`);
  try {
    await mkdir(fakeBin, { recursive: true });
    await Bun.write(
      executable,
      `#!${process.execPath}\nawait Bun.write('.oversized', Buffer.alloc(301 * 1024 * 1024));\nsetInterval(() => {}, 1000);\n`
    );
    await chmod(executable, 0o755);
    process.env.PATH = `${fakeBin}:${previousPath}`;
    await expect(installPackage("clsx", "2.1.1", jobId)).rejects.toThrow(
      "temporary storage budget"
    );
  } finally {
    process.env.PATH = previousPath;
    await cleanup(jobId);
    await rm(fakeBin, { recursive: true, force: true });
  }
  expect(existsSync(path)).toBe(false);
}, 10_000);

test("storage accounting tolerates concurrent extraction directory removal", async () => {
  const { mkdtemp, mkdir, rm, rename, writeFile } =
    await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "installer-race-"));
  let running = true;
  const writer = (async () => {
    while (running) {
      const extracting = join(root, "extracting");
      const installed = join(root, "installed");
      await mkdir(join(extracting, "nested"), { recursive: true });
      await writeFile(join(extracting, "nested", "data"), Buffer.alloc(4096));
      await rename(extracting, installed);
      await rm(installed, { recursive: true, force: true });
    }
  })();
  try {
    for (let i = 0; i < 100; i++) {
      expect(await getDirectorySize(root)).toBeGreaterThanOrEqual(0);
    }
  } finally {
    running = false;
    await writer;
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);

test("storage accounting measures regular files without following symlinks", async () => {
  const { mkdtemp, mkdir, rm, symlink, writeFile } =
    await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "installer-size-"));
  try {
    const job = join(root, "job");
    await mkdir(job);
    await writeFile(join(job, "data"), Buffer.alloc(123));
    await writeFile(join(root, "outside"), Buffer.alloc(999));
    await symlink(join(root, "outside"), join(job, "link"));
    expect(await getDirectorySize(job)).toBe(123);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.skipIf(process.getuid?.() === 0)(
  "storage accounting propagates permission failures",
  async () => {
    const { chmod, mkdtemp, rm } = await import("node:fs/promises");
    const root = await mkdtemp(join(tmpdir(), "installer-permission-"));
    try {
      await chmod(root, 0o000);
      await expect(getDirectorySize(root)).rejects.toMatchObject({
        code: "EACCES",
      });
    } finally {
      await chmod(root, 0o700);
      await rm(root, { recursive: true, force: true });
    }
  }
);
