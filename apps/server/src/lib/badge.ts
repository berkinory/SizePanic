import type { BundleSizes } from "@SizePanic/api";

import { Elysia } from "elysia";

import { analyzePackage } from "./bundle/executor";
import { resolveVersion } from "./bundle/version";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sizeColor(bytes: number): string {
  if (bytes < 10_240) return "brightgreen";
  if (bytes < 25_600) return "green";
  if (bytes < 51_200) return "yellow";
  if (bytes < 102_400) return "orange";
  return "red";
}

type SizeType = keyof BundleSizes;

function errorBadge(label: string, message: string) {
  return {
    schemaVersion: 1,
    label,
    message,
    color: "red",
    subject: label,
    status: message,
    isError: true,
  };
}

async function handleBadge(
  name: string,
  query: { version?: string; type?: string }
) {
  const sizeType: SizeType =
    query.type === "brotli" || query.type === "raw" ? query.type : "gzip";
  const label = `${name} ${sizeType}`;

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
      color: sizeColor(bytes),
      subject: label,
      status: message,
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
      return errorBadge("sizepanic", "missing package name");
    }
    return handleBadge(name, query);
  }
);
