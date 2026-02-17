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

async function analyzeOne(
  ctx: {
    resolveVersion: (name: string, version?: string) => string;
    analyzePackage: (name: string, version: string) => Promise<any>;
  },
  packageName: string,
  packageVersion?: string
) {
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
}

export const bundleRouter = router({
  analyze: publicProcedure
    .input(packageSchema)
    .mutation(async ({ input, ctx }) => {
      return analyzeOne(ctx, input.packageName, input.packageVersion);
    }),

  analyzeBatch: publicProcedure
    .input(z.object({ packages: z.array(packageSchema).min(1).max(50) }))
    .mutation(async ({ input, ctx }) => {
      return processBatch(
        input.packages,
        ({ packageName, packageVersion }) =>
          analyzeOne(ctx, packageName, packageVersion),
        15
      );
    }),
});
