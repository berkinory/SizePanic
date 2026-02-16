import { z } from "zod";

import { publicProcedure, router } from "../index";

const SLOW_3G_KBPS = 50;
const FAST_4G_KBPS = 1430;

function downloadTime(bytes: number, kbps: number): number {
  return Math.round((bytes / 1024 / kbps) * 1000);
}

const versionSchema = z
  .string()
  .min(1)
  .refine((v) => v === "latest" || /^[\d.*x^~>=< ||-]+/.test(v), {
    message: "Version must be a valid semver version or range, or 'latest'",
  })
  .optional();

const packageSchema = z.object({
  packageName: z.string().min(1),
  packageVersion: versionSchema,
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

export const bundleRouter = router({
  analyze: publicProcedure
    .input(
      z.union([
        packageSchema,
        z.object({
          packages: z.array(packageSchema).min(1).max(50),
        }),
      ])
    )
    .mutation(async ({ input, ctx }) => {
      const isBatch = "packages" in input;
      const packagesToAnalyze = isBatch
        ? input.packages
        : [
            {
              packageName: input.packageName,
              packageVersion: input.packageVersion,
            },
          ];

      const results = await processBatch(
        packagesToAnalyze,
        async ({ packageName, packageVersion }) => {
          const version = ctx.resolveVersion(packageName, packageVersion);
          const result = await ctx.analyzePackage(packageName, version);

          if (!result.success) {
            return {
              packageName: result.packageName,
              packageVersion: result.packageVersion,
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
            sizes: result.sizes,
            metadata: result.metadata,
            downloadTime: {
              slow3G: downloadTime(result.sizes.gzip, SLOW_3G_KBPS),
              fast4G: downloadTime(result.sizes.gzip, FAST_4G_KBPS),
            },
            duration: result.duration,
          };
        },
        20
      );

      if (!isBatch) {
        const result = results[0];
        if (!result) {
          return {
            packageName:
              packagesToAnalyze[0]?.packageName ?? "unknown-package-name",
            packageVersion:
              packagesToAnalyze[0]?.packageVersion ?? "unknown-version",
            error: {
              code: "UNKNOWN",
              message: "No result returned",
            },
          };
        }
        return result;
      }

      return results;
    }),
});
