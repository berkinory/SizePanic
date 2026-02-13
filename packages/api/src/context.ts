import type { Context as ElysiaContext } from "elysia";

export interface CreateContextOptions {
  context: ElysiaContext;
}

export const createContext = async ({ context }: CreateContextOptions) => {
  return {
    request: context.request,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
