import { createFileRoute } from "@tanstack/react-router";

import PackageSearch from "@/components/upload";

const HomeComponent = () => (
  <div className="relative flex min-h-svh flex-col items-center justify-center px-4">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
    <PackageSearch />
  </div>
);

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
