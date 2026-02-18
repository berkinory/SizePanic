import type { BundleResponse } from "@SizePanic/api";

import { env } from "@SizePanic/env/server";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { valid, validRange } from "semver";

const CACHE_NAMESPACE = "sp:bundle-cache:v1";
const CACHE_SCHEMA = "schema-v1";
const MEMORY_MAX_ENTRIES = 1000;
const LOCK_TTL_SECONDS = 45;

const BUILD_FINGERPRINT = [
  CACHE_SCHEMA,
  `bun-${Bun.version}`,
  "target-browser",
  "format-esm",
  "minify-true",
  "ignore-scripts",
  "omit-peer-optional",
].join("|");

interface MemoryEntry {
  value: BundleResponse;
  expiresAt: number;
}

interface CacheLock {
  key: string;
  token: string;
}

const memoryCache = new Map<string, MemoryEntry>();
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  if (!env.REDIS_URL) {
    redisClient = null;
    return redisClient;
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1200,
    commandTimeout: 1200,
  });

  client.on("error", (error) => {
    console.warn("[redis] command failed", error);
  });

  redisClient = client;
  return redisClient;
}

function getFromMemory(key: string): BundleResponse | undefined {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (!entry) return;
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return;
  }

  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.value;
}

function setToMemory(
  key: string,
  value: BundleResponse,
  ttlSeconds: number
): void {
  if (ttlSeconds <= 0) return;
  if (memoryCache.size >= MEMORY_MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function cacheKey(
  packageName: string,
  packageVersion: string,
  subpath?: string
): string {
  const normalizedSubpath = subpath?.replace(/^\.\//, "") || "root";
  return `${CACHE_NAMESPACE}:${packageName}@${packageVersion}:${normalizedSubpath}:${BUILD_FINGERPRINT}`;
}

function lockKey(key: string): string {
  return `${key}:lock`;
}

export function getCacheTtlSeconds(requestedVersion: string): number {
  if (requestedVersion === "latest") {
    return 3600;
  }

  if (valid(requestedVersion) || validRange(requestedVersion)) {
    return 21600;
  }

  return 21600;
}

function getErrorTtlSeconds(
  response: BundleResponse,
  successTtlSeconds: number
): number {
  if (response.success) {
    return successTtlSeconds;
  }

  const { code, message } = response.error;
  if (
    code === "NO_ENTRY_POINT" ||
    code === "UNSUPPORTED_PACKAGE" ||
    code === "NODE_BUILTIN_MODULES" ||
    code === "SIZE_LIMIT_EXCEEDED"
  ) {
    return Math.min(successTtlSeconds, 3600);
  }

  if (code === "INSTALL_FAILED") {
    if (message.includes("not found") || message.includes("No version of")) {
      return 1800;
    }
    return 120;
  }

  if (
    code === "TIMEOUT" ||
    code === "UNKNOWN" ||
    code === "BUNDLE_FAILED" ||
    code === "FETCH_FAILED"
  ) {
    return 60;
  }

  return 60;
}

export async function getCachedBundleResponse(
  packageName: string,
  packageVersion: string,
  subpath?: string
): Promise<BundleResponse | undefined> {
  const key = cacheKey(packageName, packageVersion, subpath);
  const memoryValue = getFromMemory(key);
  if (memoryValue) {
    return memoryValue;
  }

  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    const raw = await redis.get(key);
    if (!raw) return;

    const parsed = JSON.parse(raw) as BundleResponse;
    setToMemory(key, parsed, 30);
    return parsed;
  } catch {
    return;
  }
}

export async function setCachedBundleResponse(
  packageName: string,
  packageVersion: string,
  subpath: string | undefined,
  response: BundleResponse
): Promise<void> {
  const ttlSeconds = getErrorTtlSeconds(
    response,
    getCacheTtlSeconds(packageVersion)
  );
  if (ttlSeconds <= 0) return;

  const key = cacheKey(packageName, packageVersion, subpath);
  setToMemory(key, response, Math.min(ttlSeconds, 60));

  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(response), "EX", ttlSeconds);
  } catch {
    return;
  }
}

export async function tryAcquireBundleLock(
  packageName: string,
  packageVersion: string,
  subpath?: string
): Promise<CacheLock | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const key = lockKey(cacheKey(packageName, packageVersion, subpath));
  const token = randomUUID();

  try {
    const acquired = await redis.set(key, token, "EX", LOCK_TTL_SECONDS, "NX");
    if (acquired !== "OK") {
      return null;
    }

    return { key, token };
  } catch {
    return null;
  }
}

export async function releaseBundleLock(lock: CacheLock | null): Promise<void> {
  if (!lock) return;
  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    await redis.eval(script, 1, lock.key, lock.token);
  } catch {
    return;
  }
}

export async function waitForBundleCacheFill(
  packageName: string,
  packageVersion: string,
  subpath?: string
): Promise<BundleResponse | undefined> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  const timeoutAt = Date.now() + 3500;
  while (Date.now() < timeoutAt) {
    const cached = await getCachedBundleResponse(
      packageName,
      packageVersion,
      subpath
    );
    if (cached) return cached;
    await Bun.sleep(120);
  }
}
