import { cors } from "@elysiajs/cors";
import { createContext } from "@SizePanic/api/context";
import { appRouter } from "@SizePanic/api/routers/index";
import { env } from "@SizePanic/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";

new Elysia()
  .use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      origin: env.WEB_URL || "http://localhost:4002",
    })
  )
  .all("/trpc/*", async (context) => {
    const res = await fetchRequestHandler({
      createContext: () => createContext({ context }),
      endpoint: "/trpc",
      req: context.request,
      router: appRouter,
    });
    return res;
  })
  .get("/", () => "OK")
  .listen(4000, () => {
    console.log("Server is running on http://localhost:4000");
  });
