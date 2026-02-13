import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
    WEB_URL: z.url().optional(),
  },
});
