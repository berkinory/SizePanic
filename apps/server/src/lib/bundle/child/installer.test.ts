import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cleanup } from "./cleanup";
import { installPackage } from "./installer";

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
