import { publicProcedure, router } from "../index";
import { bundleRouter } from "./bundle";

export const appRouter = router({
  bundle: bundleRouter,
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: publicProcedure.query(() => ({
    message: "This is private",
  })),
});
export type AppRouter = typeof appRouter;
