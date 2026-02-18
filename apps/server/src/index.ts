import { cors } from "@elysiajs/cors";
import { createContext } from "@SizePanic/api/context";
import { appRouter } from "@SizePanic/api/routers/index";
import { env } from "@SizePanic/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { spawn } from "node:child_process";
import { isIP } from "node:net";

import { badgePlugin } from "./lib/badge";
import { runBundleChildFromStdin } from "./lib/bundle/child/bundle";
import { analyzePackage } from "./lib/bundle/executor";
import { resolveVersion } from "./lib/bundle/version";

function scheduleCacheCleanup() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  const ms = next.getTime() - now.getTime();

  setTimeout(() => {
    let rescheduled = false;
    const reschedule = () => {
      if (rescheduled) return;
      rescheduled = true;
      scheduleCacheCleanup();
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("bun", ["pm", "cache", "rm"], { stdio: "ignore" });
    } catch (error) {
      console.warn("[cache-cleanup] skipped: bun is not available", error);
      reschedule();
      return;
    }

    child.on("error", (error) => {
      console.warn("[cache-cleanup] failed to start", error);
      reschedule();
    });

    child.on("close", (code) => {
      console.log(`[cache-cleanup] bun pm cache rm — exit ${code}`);
      reschedule();
    });
  }, ms);

  console.log(`[cache-cleanup] Next cleanup in ${Math.round(ms / 1000 / 60)}m`);
}

async function boot() {
  if (process.argv.includes("--bundle-child")) {
    await runBundleChildFromStdin();
    process.exit(0);
  }

  scheduleCacheCleanup();

  function getClientIp(req: Request, server: unknown): string {
    const headers = req.headers;
    const cfIp = extractIp(headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;

    const forwardedFor = extractIp(headers.get("x-forwarded-for"));
    if (forwardedFor) return forwardedFor;

    if (!server) return "unknown";
    const socketIp =
      (
        server as { requestIP(r: Request): { address: string } | null }
      ).requestIP(req)?.address || "unknown";
    return extractIp(socketIp) || "unknown";
  }

  function extractIp(raw: string | null): string | undefined {
    if (!raw) return;
    const candidate = raw.split(",")[0]?.trim();
    if (!candidate || candidate.length > 100) return;

    if (candidate.startsWith("[") && candidate.includes("]")) {
      const bracketEnd = candidate.indexOf("]");
      const ipv6 = candidate.slice(1, bracketEnd);
      if (isIP(ipv6)) return ipv6;
    }

    if (isIP(candidate)) return candidate;

    const ipv4WithPortMatch = candidate.match(
      /^((?:\d{1,3}\.){3}\d{1,3}):(\d{1,5})$/
    );
    const ipv4WithPort = ipv4WithPortMatch?.[1];
    if (ipv4WithPort && isIP(ipv4WithPort)) {
      return ipv4WithPort;
    }
  }

  function isBatchRequest(req: Request): boolean {
    return new URL(req.url).pathname.includes("bundle.analyzeBatch");
  }

  new Elysia()
    .use(badgePlugin)
    .use(
      rateLimit({
        duration: 60_000,
        max: 20,
        errorResponse: "Too many requests. Please try again later.",
        generator: (req, server) => getClientIp(req, server),
        skip: (req) => isBatchRequest(req),
      })
    )
    .use(
      rateLimit({
        duration: 60_000,
        max: 3,
        errorResponse: "Too many batch requests. Please try again later.",
        generator: (req, server) => `batch:${getClientIp(req, server)}`,
        skip: (req) => !isBatchRequest(req),
      })
    )
    .use(
      cors({
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        origin: env.WEB_URL || "http://localhost:4002",
      })
    )
    .all(
      "/trpc/*",
      async (context) => {
        const res = await fetchRequestHandler({
          createContext: () =>
            createContext({ context, analyzePackage, resolveVersion }),
          endpoint: "/trpc",
          req: context.request,
          router: appRouter,
        });
        return res;
      },
      { parse: "none" }
    )
    .get("/", () => "OK")
    .listen(4000, () => {
      console.log("Server is running on http://localhost:4000");
    });
}

boot().catch((error) => {
  console.error("Fatal server startup error", error);
  process.exit(1);
});
