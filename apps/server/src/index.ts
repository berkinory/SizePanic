import { cors } from "@elysiajs/cors";
import { createContext } from "@SizePanic/api/context";
import { appRouter } from "@SizePanic/api/routers/index";
import { env } from "@SizePanic/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

import { badgePlugin } from "./lib/badge";
import { analyzePackage } from "./lib/bundle/executor";
import { resolveVersion } from "./lib/bundle/version";

new Elysia()
  .use(
    rateLimit({
      duration: 60_000,
      max: 15,
      errorResponse: "Too many requests. Please try again later.",
      generator: (req, server) => {
        const headers = req.headers;
        const cfIp = headers.get("cf-connecting-ip");
        if (cfIp) return cfIp;

        const forwardedFor = headers.get("x-forwarded-for");
        if (typeof forwardedFor === "string") {
          return forwardedFor.split(",")[0]?.trim() || "unknown";
        }

        if (!server) return "unknown";
        return server.requestIP(req)?.address || "unknown";
      },
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
  .use(badgePlugin)
  .get("/", () => "OK")
  .listen(4000, () => {
    console.log("Server is running on http://localhost:4000");
  });
