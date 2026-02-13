# Bundle Size Analyzer Implementation Plan

## Context

Building a Bundlephobia-like bundle size analyzer service integrated directly into the server app. The server will handle both Redis caching and bundle analysis via child processes.

**Why:** We need a single service that exposes a tRPC endpoint to analyze npm package bundle sizes, cache results in Redis, and safely execute bundle jobs in isolated child processes.

**Architecture Decision:**

- Server = single service (ElysiaJS + tRPC + Redis)
- tRPC endpoint: `bundle.analyze` - accepts package name/version, returns bundle sizes
- Redis caching: Check cache first, spawn child process only on cache miss
- Child processes: 1 per analysis job (isolated, crash-safe, timeout-enforced)
- No separate worker container - everything runs in server

## Requirements

**Performance:**

- <100ms response for cached results
- <1.5s response for cold analysis
- Redis cache with TTL (48 hours)
- Single endpoint accepts both single package and array (max 20 packages to prevent abuse)

**Safety & Isolation:**

- 1 child process per job (child crash → server stays alive)
- 15s timeout per job
- 10MB tarball size limit
- 50MB extracted size limit
- Max 5 concurrent module analysis

**Security:**

- Read-only access where possible
- Temp directories in /tmp with cleanup
- No arbitrary code execution (only Bun.build)
- No root access, no postinstalls

## Implementation Structure

### Server App Structure (apps/server/)

```
apps/server/
└── src/
    ├── index.ts                       # Existing Elysia + tRPC server
    ├── lib/
    │   ├── bundle/
    │   │   ├── executor.ts            # Child process spawner
    │   │   ├── concurrency.ts         # Semaphore (max 5 concurrent)
    │   │   └── child/
    │   │       ├── bundle.ts          # Main child entry point
    │   │       ├── fetcher.ts         # Fetch tarball from npm
    │   │       ├── extractor.ts       # Extract to /tmp
    │   │       ├── bundler.ts         # Bun.build() wrapper
    │   │       ├── size-calculator.ts # Calculate sizes
    │   │       └── cleanup.ts         # Remove /tmp directories
    │   └── redis.ts                   # Redis client singleton
    └── types/
        └── bundle.ts                  # Bundle analysis types
```

### API Package Structure (packages/api/)

```
packages/api/
└── src/
    ├── routers/
    │   ├── index.ts                   # Update with bundle router
    │   └── bundle.ts                  # New bundle router
    └── context.ts                     # Add Redis to context
```

## Type Definitions

**apps/server/src/types/bundle.ts:**

```typescript
export interface BundleRequest {
  packageName: string;
  packageVersion: string;
  jobId: string;
}

export interface BundleSizes {
  raw: number;
  gzip: number;
  brotli: number;
}

export interface BundleResult {
  success: true;
  sizes: BundleSizes;
  duration: number;
  packageName: string;
  packageVersion: string;
  jobId: string;
  timestamp: number;
}

export type BundleErrorCode =
  | "TIMEOUT"
  | "SIZE_LIMIT_EXCEEDED"
  | "FETCH_FAILED"
  | "BUNDLE_FAILED"
  | "UNKNOWN";

export interface BundleError {
  success: false;
  error: {
    code: BundleErrorCode;
    message: string;
  };
  duration: number;
  packageName: string;
  packageVersion: string;
  jobId: string;
  timestamp: number;
}

export type BundleResponse = BundleResult | BundleError;
```

## Core Components

### 1. tRPC Router (packages/api/src/routers/bundle.ts)

```typescript
import { z } from "zod";
import { publicProcedure, router } from "../index";
import { analyzePackage } from "apps/server/src/lib/bundle/executor";

const CACHE_TTL = 60 * 60 * 48; // 48 hours

const packageSchema = z.object({
  packageName: z.string().min(1),
  packageVersion: z.string().min(1),
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
    .query(async ({ input, ctx }) => {
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
          const cacheKey = `bundle:${packageName}@${packageVersion}`;

          // Check Redis cache (48 hour TTL)
          const cached = await ctx.redis.get(cacheKey);
          if (cached) {
            return JSON.parse(cached);
          }

          // Execute bundle analysis via child process
          const result = await analyzePackage(packageName, packageVersion);

          // Cache successful results for 48 hours
          if (result.success) {
            await ctx.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
          }

          return result;
        })
      );

      return isBatch ? results : results[0];
    }),
});
```

### 2. Redis Client (apps/server/src/lib/redis.ts)

```typescript
import { createClient } from "redis";
import { env } from "@SizePanic/env/server";

let redis: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (!redis) {
    redis = createClient({
      url: env.REDIS_URL || "redis://localhost:6379",
    });
    await redis.connect();
  }
  return redis;
}
```

### 3. Concurrency Limiter (apps/server/src/lib/bundle/concurrency.ts)

Semaphore pattern with max 4 concurrent jobs:

```typescript
class Semaphore {
  private count: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.count = max;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.count++;
    const next = this.queue.shift();
    if (next) {
      this.count--;
      next();
    }
  }
}

export const bundleSemaphore = new Semaphore(4);
```

### 4. Child Process Executor (apps/server/src/lib/bundle/executor.ts)

Spawns child process, enforces timeout, handles crashes:

```typescript
import { spawn } from "child_process";
import { nanoid } from "nanoid";
import type { BundleRequest, BundleResponse } from "../../types/bundle";
import { bundleSemaphore } from "./concurrency";

export async function analyzePackage(
  packageName: string,
  packageVersion: string
): Promise<BundleResponse> {
  await bundleSemaphore.acquire();

  try {
    const jobId = nanoid();
    const request: BundleRequest = { packageName, packageVersion, jobId };

    return await spawnChildProcess(request);
  } finally {
    bundleSemaphore.release();
  }
}

async function spawnChildProcess(
  request: BundleRequest
): Promise<BundleResponse> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", "src/lib/bundle/child/bundle.ts"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1000);
    }, 15000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        resolve({
          success: false,
          error: { code: "TIMEOUT", message: "Analysis exceeded 15s timeout" },
          duration: 15000,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
        return;
      }

      if (code !== 0) {
        resolve({
          success: false,
          error: {
            code: "UNKNOWN",
            message: `Child process exited with code ${code}`,
          },
          duration: 0,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
        return;
      }

      try {
        const response = JSON.parse(stdout) as BundleResponse;
        resolve(response);
      } catch {
        resolve({
          success: false,
          error: {
            code: "UNKNOWN",
            message: "Failed to parse child process output",
          },
          duration: 0,
          packageName: request.packageName,
          packageVersion: request.packageVersion,
          jobId: request.jobId,
          timestamp: Date.now(),
        });
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
```

### 5. Child Process Logic (apps/server/src/lib/bundle/child/)

#### a. Main Orchestration (bundle.ts)

Reads stdin, orchestrates fetch → extract → bundle → calculate → cleanup:

```typescript
import { fetchTarball } from "./fetcher";
import { extractTarball } from "./extractor";
import { bundlePackage } from "./bundler";
import { calculateSizes } from "./size-calculator";
import { cleanup } from "./cleanup";
import type { BundleRequest, BundleResponse } from "../../../types/bundle";

async function main() {
  try {
    const input = await readStdin();
    const request = JSON.parse(input) as BundleRequest;
    const startTime = Date.now();

    try {
      const tarball = await fetchTarball(
        request.packageName,
        request.packageVersion
      );
      const jobDir = `/tmp/job-${request.jobId}`;

      await extractTarball(tarball, jobDir);
      const bundledCode = await bundlePackage(jobDir);
      const sizes = calculateSizes(bundledCode);

      await cleanup(request.jobId);

      const response: BundleResponse = {
        success: true,
        sizes,
        duration: Date.now() - startTime,
        packageName: request.packageName,
        packageVersion: request.packageVersion,
        jobId: request.jobId,
        timestamp: Date.now(),
      };

      console.log(JSON.stringify(response));
      process.exit(0);
    } catch (error) {
      await cleanup(request.jobId);

      const response: BundleResponse = {
        success: false,
        error: {
          code: mapErrorCode(error),
          message: error instanceof Error ? error.message : String(error),
        },
        duration: Date.now() - startTime,
        packageName: request.packageName,
        packageVersion: request.packageVersion,
        jobId: request.jobId,
        timestamp: Date.now(),
      };

      console.log(JSON.stringify(response));
      process.exit(0);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
```

#### b. Fetcher (fetcher.ts)

Fetches tarball from npm registry with size validation.

#### c. Extractor (extractor.ts)

Extracts tarball using `tar` library with size checks.

#### d. Bundler (bundler.ts)

Finds entry point from package.json and runs Bun.build().

#### e. Size Calculator (size-calculator.ts)

Calculates raw, gzip, and brotli sizes using pako and Bun.gzipSync.

#### f. Cleanup (cleanup.ts)

Removes /tmp/job-{id} directory.

## Environment Variables

**packages/env/src/server.ts** - Add:

```typescript
REDIS_URL: z.string().url().optional().default("redis://localhost:6379"),
MAX_BUNDLE_CONCURRENCY: z.coerce.number().default(4),
BUNDLE_TIMEOUT: z.coerce.number().default(15000),
MAX_TARBALL_SIZE: z.coerce.number().default(10 * 1024 * 1024),
MAX_EXTRACTED_SIZE: z.coerce.number().default(50 * 1024 * 1024),
NPM_REGISTRY_URL: z.string().url().default("https://registry.npmjs.org"),
```

## Dependencies

**apps/server/package.json** - Add:

```json
{
  "dependencies": {
    "nanoid": "^5.0.9",
    "pako": "^2.1.0",
    "redis": "^4.7.0",
    "tar": "^7.4.4"
  },
  "devDependencies": {
    "@types/pako": "^2.0.3",
    "@types/tar": "^6.1.13"
  }
}
```

## Implementation Order

### Phase 1: Foundation

1. Add environment variables to `packages/env/src/server.ts`
2. Install dependencies in `apps/server`
3. Create type definitions in `apps/server/src/types/bundle.ts`
4. Create Redis client singleton in `apps/server/src/lib/redis.ts`

### Phase 2: Child Process Logic

5. Implement `apps/server/src/lib/bundle/child/fetcher.ts`
6. Implement `apps/server/src/lib/bundle/child/extractor.ts`
7. Implement `apps/server/src/lib/bundle/child/bundler.ts`
8. Implement `apps/server/src/lib/bundle/child/size-calculator.ts`
9. Implement `apps/server/src/lib/bundle/child/cleanup.ts`
10. Implement `apps/server/src/lib/bundle/child/bundle.ts`

### Phase 3: Process Management

11. Implement `apps/server/src/lib/bundle/concurrency.ts`
12. Implement `apps/server/src/lib/bundle/executor.ts`

### Phase 4: tRPC Integration

13. Create `packages/api/src/routers/bundle.ts`
14. Update `packages/api/src/routers/index.ts` to include bundle router
15. Update `packages/api/src/context.ts` to add Redis client
16. Update `apps/server/src/index.ts` to initialize Redis on startup

### Phase 5: Quality Gates

17. Run `bun check` (lint + format)
18. Run `bun check-types` (type checking)
19. Fix all errors to zero

## Testing & Verification

### Local Testing

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start server
cd apps/server
bun dev

# Test single package analysis
curl http://localhost:4000/trpc/bundle.analyze?input={"packageName":"lodash","packageVersion":"4.17.21"}

# Test batch analysis (same endpoint, multiple packages)
curl http://localhost:4000/trpc/bundle.analyze?input={"packages":[{"packageName":"lodash","packageVersion":"4.17.21"},{"packageName":"react","packageVersion":"18.2.0"}]}
```

### Test Cases

1. **Single package (lodash@4.17.21)** → returns single result object, cached for 48 hours
2. **Batch request (5 packages)** → returns array of results, respects concurrency (max 5)
3. **Batch max limit (21 packages)** → validation error (max 20)
4. **Batch with cache mix** → some from cache (<100ms), some fresh analysis
5. **Non-existent package** → error: FETCH_FAILED
6. **Invalid version** → error: FETCH_FAILED
7. **Concurrent jobs (10 parallel single)** → max 5 concurrent, rest queued
8. **Cache hit** → <100ms response
9. **Cache miss** → <1.5s response
10. **Cache expiry** → after 48 hours, re-analyzes package

### Quality Gates

```bash
bun check          # Must pass with 0 errors
bun check-types    # Must pass with 0 errors
```

## Success Criteria

- tRPC endpoint `bundle.analyze` accepts both single package and array (max 20)
- Single package returns object, array returns array of results
- Redis caching works (48 hour TTL)
- Child processes spawn correctly with 15s timeout
- Max 5 concurrent analysis jobs enforced (semaphore controls this)
- Tarball size < 10MB, extracted size < 50MB validated
- Child process crashes don't affect server stability
- Cache hits return <100ms
- Cold analysis completes <1.5s
- Batch requests process all packages in parallel (respecting concurrency limit)
- All quality gates pass
