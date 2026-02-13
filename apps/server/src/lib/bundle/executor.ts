import type { BundleRequest, BundleResponse } from "@SizePanic/api";

import { nanoid } from "nanoid";
import { spawn } from "node:child_process";

import { bundleSemaphore } from "./concurrency";
import { BUNDLE_TIMEOUT } from "./constants";
import { parsePackageName } from "./parse-package";

export async function analyzePackage(
  packageName: string,
  packageVersion: string
): Promise<BundleResponse> {
  await bundleSemaphore.acquire();

  try {
    const jobId = nanoid();
    const parsed = parsePackageName(packageName);
    const request: BundleRequest = {
      packageName: parsed.name,
      packageVersion,
      subpath: parsed.subpath,
      jobId,
    };

    return await spawnChildProcess(request);
  } finally {
    bundleSemaphore.release();
  }
}

function spawnChildProcess(request: BundleRequest): Promise<BundleResponse> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", "src/lib/bundle/child/bundle.ts"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

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

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
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
