import type { BundleSizes } from "@SizePanic/api";

import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const GZIP_LEVEL = 6;
const BROTLI_QUALITY = 11;

export function calculateSizes(code: string): BundleSizes {
  const raw = Buffer.byteLength(code, "utf-8");
  const gzip = gzipSync(code, { level: GZIP_LEVEL }).byteLength;
  const brotli = brotliCompressSync(code, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
    },
  }).byteLength;

  return { raw, gzip, brotli };
}
