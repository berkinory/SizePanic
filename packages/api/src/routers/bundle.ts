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

export const bundleRouter = router({
  analyze: publicProcedure
    .input(
      z.union([
        packageSchema,
        z.object({
          packages: z.array(packageSchema).min(1).max(20),
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

      const results = await Promise.all(
        packagesToAnalyze.map(async ({ packageName, packageVersion }) => {
          const resolved = await ctx.resolveVersion(
            packageName,
            packageVersion
          );
          const result = await ctx.analyzePackage(packageName, resolved);

          if (!result.success) {
            throw new TRPCError({
              code: errorCodeMap[result.error.code] ?? "INTERNAL_SERVER_ERROR",
              message: result.error.message,
            });
          }

          return {
            sizes: result.sizes,
            metadata: result.metadata,
            downloadTime: {
              slow3G: downloadTime(result.sizes.gzip, SLOW_3G_KBPS),
              fast4G: downloadTime(result.sizes.gzip, FAST_4G_KBPS),
            },
            duration: result.duration,
          };
        })
      );

      return isBatch ? results : results[0];
    }),
});
