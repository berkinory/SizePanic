import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: publicProcedure.query(() => ({
    message: "This is private",
  })),
});
export type AppRouter = typeof appRouter;
