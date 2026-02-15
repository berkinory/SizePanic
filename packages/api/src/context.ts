import type { Context as ElysiaContext } from "elysia";

import type { BundleResult, BundleError } from "./types";

export type BundleAnalysisResult = BundleResult | BundleError;

export type AnalyzePackageFn = (
  packageName: string,
  packageVersion: string
) => Promise<BundleAnalysisResult>;

export type ResolveVersionFn = (
  packageName: string,
  version: string | undefined
) => string;

export interface CreateContextOptions {
  context: ElysiaContext;
  analyzePackage: AnalyzePackageFn;
  resolveVersion: ResolveVersionFn;
}

export const createContext = async ({
  context,
  analyzePackage,
  resolveVersion,
}: CreateContextOptions) => {
  return {
    analyzePackage,
    request: context.request,
    resolveVersion,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
