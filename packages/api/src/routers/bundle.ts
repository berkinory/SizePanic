import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";

const SLOW_3G_KBPS = 50;
const FAST_4G_KBPS = 1430;

function downloadTime(bytes: number, kbps: number): number {
  return Math.round((bytes / 1024 / kbps) * 1000);
}

const errorCodeMap: Record<string, TRPCError["code"]> = {
  FETCH_FAILED: "NOT_FOUND",
  SIZE_LIMIT_EXCEEDED: "PAYLOAD_TOO_LARGE",
  TIMEOUT: "TIMEOUT",
  BUNDLE_FAILED: "INTERNAL_SERVER_ERROR",
  UNKNOWN: "INTERNAL_SERVER_ERROR",
};

const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

const versionSchema = z
  .string()
  .refine((v) => v === "latest" || semverRegex.test(v), {
    message: "Version must be a valid semver (e.g. 1.0.0) or 'latest'",
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
              code:
                error instanceof TRPCError
                  ? error.code
                  : "INTERNAL_SERVER_ERROR",
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
          packages: z.array(packageSchema).min(1).max(300),
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
          const resolved = await ctx.resolveVersion(
            packageName,
            packageVersion
          );
          const result = await ctx.analyzePackage(packageName, resolved);

          if (!result.success) {
            return {
              packageName,
              packageVersion: resolved,
              error: {
                code: result.error.code,
                message: result.error.message,
              },
            };
          }

          return {
            packageName,
            packageVersion: resolved,
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No result returned",
          });
        }
        if ("error" in result && result.error) {
          throw new TRPCError({
            code: errorCodeMap[result.error.code] ?? "INTERNAL_SERVER_ERROR",
            message: result.error.message,
          });
        }
        return result;
      }

      return results;
    }),
});
