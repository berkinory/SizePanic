import { useMutation } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  type AnalyzeBatchItem,
  buildSplat,
  fade,
  formatBytes,
  loadBatchSession,
  stagger,
  updateBatchSessionResults,
} from "@/lib/package";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/batch/$id")({
  component: BatchPage,
});

function BatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const session = useRef(loadBatchSession(id));
  const hasTriggered = useRef(false);
  const [results, setResults] = useState<AnalyzeBatchItem[]>(
    session.current?.results ?? []
  );

  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());

  useEffect(() => {
    if (hasTriggered.current) return;

    if (!session.current) {
      void navigate({ to: "/" });
      return;
    }

    if (session.current.results && session.current.results.length > 0) {
      return;
    }

    hasTriggered.current = true;
    analyzeMutation.mutate(
      {
        packages: session.current.packages.map((p) => ({
          packageName: p.name,
          packageVersion: p.version,
        })),
      },
      {
        onSuccess: (data) => {
          if (!Array.isArray(data)) return;
          const batchResults = data as AnalyzeBatchItem[];
          setResults(batchResults);
          updateBatchSessionResults(id, batchResults);
        },
      }
    );
  }, []);

  const handleItemClick = (item: AnalyzeBatchItem) => {
    if (!("sizes" in item)) return;
    const splat = buildSplat({
      name: item.packageName,
      version: item.packageVersion,
    });
    void navigate({ to: `/package/${splat}` });
  };

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
              analyzing {session.current?.packages.length ?? 0} packages...
            </p>
          </motion.div>
        )}

        {results.length > 0 && (
          <motion.div
            variants={fade}
            className="rounded-xl border border-border p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.history.back()}
                className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/" })}
                className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors"
              >
                Analyze another package
              </button>
            </div>
            <div className="max-h-80 overflow-auto space-y-1.5">
              {results.map((item, index) => (
                <button
                  key={`${item.packageName}-${item.packageVersion}-${index}`}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors",
                    "sizes" in item
                      ? "cursor-pointer border-border/70 hover:border-primary/40 hover:bg-muted/30"
                      : "cursor-not-allowed border-destructive/30 bg-destructive/5"
                  )}
                >
                  <p className="font-mono text-xs text-foreground/80">
                    {item.packageName}@{item.packageVersion}
                  </p>
                  {"sizes" in item ? (
                    <p className="text-[11px] text-foreground/45 mt-0.5">
                      gzip {formatBytes(item.sizes.gzip)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-destructive/80 mt-0.5 truncate">
                      {item.error.message}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
