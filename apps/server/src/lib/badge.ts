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

type BadgeQuery = {
  version?: string;
  type?: string;
  label?: string;
  color?: string;
  labelColor?: string;
};

type BadgeAppearance = {
  label: string;
  color: string;
  labelColor: string;
};

function normalizeColor(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const maybeHex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(maybeHex) || /^[0-9a-fA-F]{6}$/.test(maybeHex)) {
    return `#${maybeHex.toLowerCase()}`;
  }

  if (/^[a-zA-Z][a-zA-Z0-9-]{1,30}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return fallback;
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 48);
}

function resolveSizeType(type: string | undefined): SizeType {
  if (type === "raw") return "raw";
  if (type === "brotli") return "brotli";
  return "gzip";
}

function errorBadge(appearance: BadgeAppearance, message: string) {
  return {
    schemaVersion: 1,
    label: appearance.label,
    message,
    color: appearance.color,
    labelColor: appearance.labelColor,
    style: BADGE_STYLE,
    namedLogo: "npm",
    isError: true,
  };
}

async function handleBadge(name: string, query: BadgeQuery) {
  const sizeType = resolveSizeType(query.type);
  const appearance: BadgeAppearance = {
    label: normalizeLabel(query.label, name),
    color: normalizeColor(query.color, BADGE_COLOR),
    labelColor: normalizeColor(query.labelColor, BADGE_LABEL_COLOR),
  };

  try {
    const version = resolveVersion(name, query.version);
    const result = await analyzePackage(name, version);

    if (!result.success) {
      return errorBadge(appearance, result.error.message);
    }

    const bytes = result.sizes[sizeType];
    const message = formatBytes(bytes);

    return {
      schemaVersion: 1,
      label: appearance.label,
      message,
      color: appearance.color,
      labelColor: appearance.labelColor,
      style: BADGE_STYLE,
      namedLogo: "npm",
    };
  } catch (e) {
    return errorBadge(
      appearance,
      e instanceof Error ? e.message : "unknown error"
    );
  }
}

export const badgePlugin = new Elysia({ name: "badge" }).get(
  "/badge/*",
  async ({ params, query, set }) => {
    set.headers["cache-control"] = "public, max-age=86400";
    const rawName = params["*"];
    const name = rawName ? decodeURIComponent(rawName) : "";
    if (!name) {
      return errorBadge(
        {
          label: "SizePanic",
          color: BADGE_COLOR,
          labelColor: BADGE_LABEL_COLOR,
        },
        "Missing package"
      );
    }
    return handleBadge(name, query);
  }
);
