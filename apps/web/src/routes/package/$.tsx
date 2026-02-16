import { useMutation } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ArrowLeft, Loader2, RotateCw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";

import {
  type AnalyzeSuccess,
  fade,
  formatBytes,
  parseInput,
  stagger,
} from "@/lib/package";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/package/$")({
  component: PackagePage,
});

function PackagePage() {
  const { _splat } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const parsed = _splat ? parseInput(_splat) : null;

  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (hasTriggered.current) return;
    if (!parsed) {
      void navigate({ to: "/" });
      return;
    }
    hasTriggered.current = true;
    analyzeMutation.mutate({
      packageName: parsed.name,
      packageVersion: parsed.version,
    });
  }, []);

  const result =
    analyzeMutation.data && !Array.isArray(analyzeMutation.data)
      ? (analyzeMutation.data as AnalyzeSuccess)
      : null;

  if (!parsed) return null;

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-lg"
      >
        {analyzeMutation.isPending && (
          <motion.div
            variants={fade}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="size-10 animate-spin text-foreground/70" />
            <p className="mt-3 font-mono text-sm text-foreground/50">
              analyzing {parsed.name}...
            </p>
          </motion.div>
        )}

        {analyzeMutation.isError && !result && (
          <motion.div
            variants={fade}
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4"
          >
            <div>
              <p className="font-mono text-sm text-foreground/80">{_splat}</p>
              <p className="text-xs text-destructive/80 mt-1">
                {analyzeMutation.error.message}
              </p>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => router.history.back()}
                className={cn(
                  "cursor-pointer text-foreground/60 hover:text-foreground transition-colors",
                  "inline-flex items-center gap-1"
                )}
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  analyzeMutation.mutate({
                    packageName: parsed.name,
                    packageVersion: parsed.version,
                  });
                }}
                className={cn(
                  "cursor-pointer text-foreground/60 hover:text-foreground transition-colors",
                  "inline-flex items-center gap-1"
                )}
              >
                <RotateCw className="size-3.5" />
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            variants={fade}
            className="rounded-xl border border-border p-5 space-y-4"
          >
            <div>
              <p className="font-mono text-sm text-foreground/80">
                {result.packageName}@{result.packageVersion}
              </p>
              <p className="text-xs text-foreground/45 mt-1">
                analyzed in {result.duration} ms
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border/70 py-2">
                <p className="text-[10px] uppercase text-foreground/40">gzip</p>
                <p className="font-mono text-sm">
                  {formatBytes(result.sizes.gzip)}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 py-2">
                <p className="text-[10px] uppercase text-foreground/40">
                  brotli
                </p>
                <p className="font-mono text-sm">
                  {formatBytes(result.sizes.brotli)}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 py-2">
                <p className="text-[10px] uppercase text-foreground/40">raw</p>
                <p className="font-mono text-sm">
                  {formatBytes(result.sizes.raw)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => router.history.back()}
                className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/" })}
                className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors"
              >
                Analyze another package
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
