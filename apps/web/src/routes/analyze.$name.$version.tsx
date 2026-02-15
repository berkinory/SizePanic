import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { trpc } from "@/utils/trpc";

function AnalyzeRouteComponent() {
  const { name, version } = Route.useParams();
  const decodedName = decodeURIComponent(name);
  const decodedVersion = decodeURIComponent(version);
  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());

  useEffect(() => {
    analyzeMutation.mutate({
      packageName: decodedName,
      packageVersion: decodedVersion,
    });
  }, [decodedName, decodedVersion]);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
      <div className="w-full max-w-lg rounded-xl border border-border bg-card/50 p-6 text-center">
        <p className="font-mono text-sm text-foreground/70">
          {decodedName}@{decodedVersion}
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          {analyzeMutation.isPending ? "Analyzing package..." : "Analyze request completed."}
        </p>
        <div className="mt-5">
          <Link
            to="/"
            className="text-xs text-foreground/50 hover:text-foreground transition-colors"
          >
            Back to search
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/analyze/$name/$version")({
  component: AnalyzeRouteComponent,
});
