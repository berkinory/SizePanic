import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    VITE_SERVER_URL: z.string().url(),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: {
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL as string | undefined,
  },
});
