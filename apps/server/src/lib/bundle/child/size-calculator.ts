import type { BundleSizes } from "@SizePanic/api";

import { brotliCompressSync } from "node:zlib";

export function calculateSizes(code: string): BundleSizes {
  const raw = Buffer.byteLength(code, "utf-8");
  const gzip = Bun.gzipSync(code).byteLength;
  const brotli = brotliCompressSync(code).byteLength;

  return { raw, gzip, brotli };
}
