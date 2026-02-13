import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function cleanup(jobId: string): Promise<void> {
  const jobDir = join(tmpdir(), `job-${jobId}`);
  await rm(jobDir, { recursive: true, force: true });
}
