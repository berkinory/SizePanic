import type {
  BundleErrorCode,
  BundleRequest,
  BundleResponse,
} from "@SizePanic/api";

import { shouldSkipPackage } from "./blacklist";
import { bundlePackage } from "./bundler";
import { cleanup } from "./cleanup";
import { BundleError, UnsupportedPackageError } from "./errors";
import { extractTarball } from "./extractor";
import { FetchError, SizeLimitError, fetchTarball } from "./fetcher";
import { calculateSizes } from "./size-calculator";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function mapErrorCode(error: unknown): BundleErrorCode {
  if (error instanceof FetchError) return "FETCH_FAILED";
  if (error instanceof SizeLimitError) return "SIZE_LIMIT_EXCEEDED";
  if (error instanceof UnsupportedPackageError) return "UNSUPPORTED_PACKAGE";
  if (error instanceof BundleError) return "BUNDLE_FAILED";
  return "UNKNOWN";
}

async function main() {
  try {
    const request = JSON.parse(await readStdin()) as BundleRequest;
    const startTime = Date.now();

    try {
      const skipCheck = shouldSkipPackage(request.packageName);
      if (skipCheck.skip) {
        throw new UnsupportedPackageError(
          skipCheck.reason || "Package is not supported"
        );
      }

      const { tarball, metadata } = await fetchTarball(
        request.packageName,
        request.packageVersion
      );
      const packageDir = await extractTarball(tarball, `job-${request.jobId}`);
      const bundledCode = await bundlePackage(packageDir, request.subpath);
      const sizes = calculateSizes(bundledCode);
      await cleanup(request.jobId);

      console.log(
        JSON.stringify({
          success: true,
          sizes,
          metadata,
          duration: Date.now() - startTime,
          jobId: request.jobId,
          timestamp: Date.now(),
        } satisfies BundleResponse)
      );
      process.exit(0);
    } catch (error) {
      await cleanup(request.jobId);
      console.error("Bundle error:", error);

      console.log(
        JSON.stringify({
          success: false,
          error: {
            code: mapErrorCode(error),
            message: error instanceof Error ? error.message : String(error),
          },
          duration: Date.now() - startTime,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        } satisfies BundleResponse)
      );
      process.exit(0);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
