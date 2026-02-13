import type {
  BundleErrorCode,
  BundleRequest,
  BundleResponse,
} from "@SizePanic/api";

import { join } from "node:path";

import { shouldSkipPackage } from "./blacklist";
import { bundlePackage } from "./bundler";
import { cleanup } from "./cleanup";
import {
  BundleError,
  InstallError,
  NodeBuiltinError,
  NoEntryPointError,
  SizeLimitError,
  UnsupportedPackageError,
} from "./errors";
import { FetchError, readMetadata } from "./fetcher";
import { installPackage } from "./installer";
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
  if (error instanceof InstallError) return "INSTALL_FAILED";
  if (error instanceof SizeLimitError) return "SIZE_LIMIT_EXCEEDED";
  if (error instanceof UnsupportedPackageError) return "UNSUPPORTED_PACKAGE";
  if (error instanceof NodeBuiltinError) return "NODE_BUILTIN_MODULES";
  if (error instanceof NoEntryPointError) return "NO_ENTRY_POINT";
  if (error instanceof BundleError) return "BUNDLE_FAILED";
  return "UNKNOWN";
}

async function main() {
  let request: BundleRequest;

  try {
    request = JSON.parse(await readStdin()) as BundleRequest;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  const startTime = Date.now();
  let response: BundleResponse;

  try {
    const skipCheck = shouldSkipPackage(request.packageName, request.subpath);
    if (skipCheck.skip) {
      throw new UnsupportedPackageError(
        skipCheck.reason || "Package is not supported"
      );
    }

    const { workDir, peerDeps } = await installPackage(
      request.packageName,
      request.packageVersion,
      request.jobId
    );

    const metadata = await readMetadata(workDir, request.packageName);

    if (!request.subpath) {
      await validateRootExport(workDir, request.packageName);
    }

    const bundledCode = await bundlePackage(
      workDir,
      request.packageName,
      request.subpath,
      peerDeps
    );

    const sizes = calculateSizes(bundledCode);

    response = {
      success: true,
      sizes,
      metadata,
      duration: Date.now() - startTime,
      jobId: request.jobId,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Bundle error:", error);
    response = {
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
    };
  }

  try {
    await cleanup(request.jobId);
  } catch (e) {
    console.error("Cleanup failed:", e);
  }

  console.log(JSON.stringify(response));
  process.exit(0);
}

async function validateRootExport(
  workDir: string,
  packageName: string
): Promise<void> {
  const pkgPath = join(workDir, "node_modules", packageName, "package.json");
  const file = Bun.file(pkgPath);
  if (!(await file.exists())) return;

  const pkg = (await file.json()) as {
    name?: string;
    main?: string;
    module?: string;
    exports?: Record<string, unknown> | string;
    browser?: string | Record<string, unknown>;
  };

  if (pkg.main || pkg.module || typeof pkg.browser === "string") return;

  if (!pkg.exports || typeof pkg.exports === "string") return;

  const hasDotExport = "." in pkg.exports;
  if (hasDotExport) return;

  const subpaths = Object.keys(pkg.exports)
    .filter((k) => k.startsWith("./") && !k.includes("*"))
    .map((k) => k.slice(2));

  if (subpaths.length > 0) {
    throw new NoEntryPointError(
      `Package doesn't have a default export. Try a subpath: ${packageName}/${subpaths[0]}`
    );
  }

  throw new NoEntryPointError(
    "Package doesn't have a recognizable entry point. It may be a CLI tool, a types-only package, or use a non-standard build."
  );
}

main();
