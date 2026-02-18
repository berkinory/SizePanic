import { z } from "zod";

import { publicProcedure, router } from "../index";

const SLOW_3G_KBPS = 50;
const FAST_4G_KBPS = 1430;
const FAST_4G_COLD_START_MS = 25;
const MAX_PACKAGE_INPUT_LENGTH = 214;
const MAX_VERSION_INPUT_LENGTH = 64;
const MAX_BATCH_SIZE = 50;
const BATCH_CONCURRENCY = 10;

const PACKAGE_SPECIFIER_REGEX =
  /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/[A-Za-z0-9._-]+)*$/;

function isSafePackageSpecifier(value: string): boolean {
  if (!PACKAGE_SPECIFIER_REGEX.test(value)) return false;
  if (value.includes("..")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("//")) return false;
  if (value.startsWith("/") || value.endsWith("/")) return false;
  return true;
}

function downloadTime(bytes: number, kbps: number): number {
  if (bytes <= 0) return 0;
  return Math.max(1, Math.ceil((bytes / 1024 / kbps) * 1000));
}

const versionSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_VERSION_INPUT_LENGTH)
  .refine((v) => v === "latest" || /^[\d.*x^~>=< ||-]+/.test(v), {
    message: "Version must be a valid semver version or range, or 'latest'",
  })
  .optional();

const packageSchema = z.object({
  packageName: z
    .string()
    .trim()
    .min(1)
    .max(MAX_PACKAGE_INPUT_LENGTH)
    .refine(isSafePackageSpecifier, {
      message: "Package name must be a valid npm package specifier",
    }),
  packageVersion: versionSchema,
  isDevDependency: z.boolean().optional(),
});

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item) =>
        processor(item).catch((error) => {
          return {
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          } as R;
        })
      )
    );
    results.push(...batchResults);
  }
  return results;
}

async function analyzeOne(
  ctx: {
    resolveVersion: (name: string, version?: string) => string;
    analyzePackage: (name: string, version: string) => Promise<any>;
  },
  packageName: string,
  packageVersion?: string,
  isDevDependency?: boolean
) {
  const version = ctx.resolveVersion(packageName, packageVersion);
  const result = await ctx.analyzePackage(packageName, version);

  if (!result.success) {
    return {
      packageName: result.packageName,
      packageVersion: result.packageVersion,
      isDevDependency,
      error: {
        code: result.error.code,
        message: result.error.message,
        ...(result.error.subpaths?.length
          ? { subpaths: result.error.subpaths }
          : {}),
      },
    };
  }

  return {
    packageName: result.metadata.name,
    packageVersion: result.metadata.version,
    isDevDependency,
    sizes: result.sizes,
    metadata: result.metadata,
    downloadTime: {
      slow3G: downloadTime(result.sizes.gzip, SLOW_3G_KBPS),
      fast4G:
        downloadTime(result.sizes.gzip, FAST_4G_KBPS) + FAST_4G_COLD_START_MS,
    },
    duration: result.duration,
  };
}

export const bundleRouter = router({
  analyze: publicProcedure
    .input(packageSchema)
    .mutation(async ({ input, ctx }) => {
      return analyzeOne(ctx, input.packageName, input.packageVersion);
    }),

  analyzeBatch: publicProcedure
    .input(
      z.object({ packages: z.array(packageSchema).min(1).max(MAX_BATCH_SIZE) })
    )
    .mutation(async ({ input, ctx }) => {
      const deduped = Array.from(
        new Map(
          input.packages.map((pkg) => [
            `${pkg.packageName}@${pkg.packageVersion || "latest"}`,
            pkg,
          ])
        ).values()
      );

      return processBatch(
        deduped,
        ({ packageName, packageVersion, isDevDependency }) =>
          analyzeOne(ctx, packageName, packageVersion, isDevDependency),
        BATCH_CONCURRENCY
      );
    }),
});
