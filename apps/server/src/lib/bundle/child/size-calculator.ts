import type { BundleSizes } from "@SizePanic/api";

import { brotliCompressSync, constants, gzipSync } from "node:zlib";

export function calculateSizes(code: string): BundleSizes {
  const raw = Buffer.byteLength(code, "utf-8");
  const gzip = gzipSync(code).byteLength;
  const brotli = brotliCompressSync(code, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 4,
    },
  }).byteLength;

  return { raw, gzip, brotli };
}
