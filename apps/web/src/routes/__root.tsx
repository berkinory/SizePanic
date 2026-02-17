import type { QueryClient } from "@tanstack/react-query";

import { Databuddy } from "@databuddy/sdk/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";

import type { trpc } from "@/utils/trpc";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

const RootComponent = () => (
  <>
    <HeadContent />
    <Databuddy
      clientId="18bb77d4-614f-4af9-b256-d4fd4fa8f9f1"
      trackOutgoingLinks
      trackWebVitals
      trackErrors
    />
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <Outlet />
      <Toaster richColors position="bottom-center" />
    </ThemeProvider>
    <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
  </>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [{ title: "SizePanic - Npm Package Size  & Bundle Analyzer" }],
  }),
});
