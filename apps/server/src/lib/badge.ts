import type { BundleSizes } from "@SizePanic/api";

import { Elysia } from "elysia";

import { analyzePackage } from "./bundle/executor";
import { resolveVersion } from "./bundle/version";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BADGE_COLOR = "#3fb950";
const BADGE_LABEL_COLOR = "#30363d";
const BADGE_STYLE = "flat-square";

type SizeType = keyof BundleSizes;

function errorBadge(label: string, message: string) {
  return {
    schemaVersion: 1,
    label,
    message,
    color: BADGE_COLOR,
    labelColor: BADGE_LABEL_COLOR,
    style: BADGE_STYLE,
    namedLogo: "npm",
    isError: true,
  };
}

async function handleBadge(
  name: string,
  query: { version?: string; type?: string }
) {
  const sizeType: SizeType =
    query.type === "brotli" || query.type === "raw" ? query.type : "gzip";
  const label = name;

  try {
    const version = resolveVersion(name, query.version);
    const result = await analyzePackage(name, version);

    if (!result.success) {
      return errorBadge(label, result.error.message);
    }

    const bytes = result.sizes[sizeType];
    const message = formatBytes(bytes);

    return {
      schemaVersion: 1,
      label,
      message,
      color: BADGE_COLOR,
      labelColor: BADGE_LABEL_COLOR,
      style: BADGE_STYLE,
      namedLogo: "npm",
    };
  } catch (e) {
    return errorBadge(label, e instanceof Error ? e.message : "unknown error");
  }
}

export const badgePlugin = new Elysia({ name: "badge" }).get(
  "/badge/*",
  async ({ params, query, set }) => {
    set.headers["cache-control"] = "public, max-age=86400";
    const name = params["*"];
    if (!name) {
      return errorBadge("SizePanic", "Missing package");
    }
    return handleBadge(name, query);
  }
);
