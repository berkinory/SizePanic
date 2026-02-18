import type { BundleRequest, BundleResponse } from "@SizePanic/api";

import { nanoid } from "nanoid";
import { spawn } from "node:child_process";

import {
  getCachedBundleResponse,
  releaseBundleLock,
  setCachedBundleResponse,
  tryAcquireBundleLock,
  waitForBundleCacheFill,
} from "./cache";
import { cleanup } from "./child/cleanup";
import { bundleSemaphore } from "./concurrency";
import { parsePackageName } from "./parse-package";

const BUNDLE_TIMEOUT = 20_000;
const QUEUE_TIMEOUT = 30_000;

export async function analyzePackage(
  packageName: string,
  packageVersion: string
): Promise<BundleResponse> {
  const jobId = nanoid();
  const parsed = parsePackageName(packageName);
  const request: BundleRequest = {
    packageName: parsed.name,
    packageVersion,
    subpath: parsed.subpath,
    jobId,
  };

  const cached = await getCachedBundleResponse(
    request.packageName,
    request.packageVersion,
    request.subpath
  );
  if (cached) {
    return cached;
  }

  const lock = await tryAcquireBundleLock(
    request.packageName,
    request.packageVersion,
    request.subpath
  );

  if (!lock) {
    const waited = await waitForBundleCacheFill(
      request.packageName,
      request.packageVersion,
      request.subpath
    );
    if (waited) {
      return waited;
    }
  }

  try {
    try {
      await bundleSemaphore.acquire(QUEUE_TIMEOUT);
    } catch (error) {
      const isQueueFull =
        error instanceof Error && error.message === "Queue is full";
      const isQueueTimeout =
        error instanceof Error && error.message === "Queue wait timeout";

      return {
        success: false,
        error: {
          code: isQueueTimeout ? "TIMEOUT" : "UNKNOWN",
          message: isQueueFull
            ? "Server is busy right now. Please try again shortly."
            : isQueueTimeout
              ? `Server is busy right now. Queue wait exceeded ${QUEUE_TIMEOUT}ms`
              : "Server is busy right now. Please try again shortly.",
        },
        duration: 0,
        packageName: request.packageName,
        packageVersion: request.packageVersion,
        jobId: request.jobId,
        timestamp: Date.now(),
      };
    }

    let response: BundleResponse;
    try {
      response = await spawnChildProcess(request);
    } finally {
      bundleSemaphore.release();
    }

    await setCachedBundleResponse(
      request.packageName,
      request.packageVersion,
      request.subpath,
      response
    );

    return response;
  } finally {
    await releaseBundleLock(lock);
  }
}

function spawnChildProcess(request: BundleRequest): Promise<BundleResponse> {
  return new Promise((resolve) => {
    const child = spawnBundleWorker();

    let stdout = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000);
    }, BUNDLE_TIMEOUT);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        await cleanup(request.jobId).catch((e) =>
          console.error("Cleanup failed after timeout:", e)
        );

        resolve({
          success: false,
          error: {
            code: "TIMEOUT",
            message: `Analysis exceeded ${BUNDLE_TIMEOUT}ms timeout`,
          },
          duration: BUNDLE_TIMEOUT,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
        return;
      }

      if (code !== 0) {
        await cleanup(request.jobId).catch((e) =>
          console.error("Cleanup failed after crash:", e)
        );

        resolve({
          success: false,
          error: {
            code: "UNKNOWN",
            message: `Child process exited with code ${code}`,
          },
          duration: 0,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
        return;
      }

      try {
        const response = JSON.parse(stdout) as BundleResponse;
        resolve(response);
      } catch {
        await cleanup(request.jobId).catch((e) =>
          console.error("Cleanup failed after parse error:", e)
        );

        resolve({
          success: false,
          error: {
            code: "UNKNOWN",
            message: "Failed to parse child process output",
          },
          duration: 0,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

function spawnBundleWorker() {
  const scriptPath = process.argv[1];
  const args =
    scriptPath && scriptPath !== "--bundle-child"
      ? [scriptPath, "--bundle-child"]
      : ["--bundle-child"];

  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
}
