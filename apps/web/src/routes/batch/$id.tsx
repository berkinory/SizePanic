import {
  Analytics03Icon,
  ArrowLeft01Icon,
  GithubIcon,
  Loading02Icon,
  NpmIcon,
  PackageSearchIcon,
} from "@hugeicons/core-free-icons";
import { type IconSvgElement, HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trackEvent } from "@/lib/analytics";
import {
  type AnalyzeBatchItem,
  type AnalyzeSuccess,
  buildSplat,
  formatBytes,
  formatMs,
  loadBatchSession,
  repoToUrl,
  updateBatchSessionResults,
} from "@/lib/package";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/batch/$id")({
  component: BatchPage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
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

  const analyzeMutation = useMutation(
    trpc.bundle.analyzeBatch.mutationOptions()
  );

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
            isDevDependency: p.isDevDependency,
          })),
        },
      {
        onSuccess: (data) => {
          if (!Array.isArray(data)) return;
          const batchResults = data as AnalyzeBatchItem[];

          const successCount = batchResults.filter(isSuccess).length;
          const failedItems = batchResults.filter(isFailure);
          const durations = batchResults
            .map((item) => ("duration" in item ? item.duration : 0))
            .filter((duration) => typeof duration === "number");
          const totalDurationMs = durations.reduce(
            (acc, value) => acc + value,
            0
          );

          trackEvent("batch_analysis", {
            package_count: batchResults.length,
            success_count: successCount,
            failure_count: failedItems.length,
            total_duration_ms: totalDurationMs,
            avg_duration_ms:
              batchResults.length > 0
                ? Math.round(totalDurationMs / batchResults.length)
                : 0,
            packages_json: JSON.stringify(
              batchResults.map((item) =>
                isSuccess(item)
                  ? {
                      package_name: item.packageName,
                      package_version: item.packageVersion,
                      success: true,
                      raw_bytes: item.sizes.raw,
                      gzip_bytes: item.sizes.gzip,
                      duration_ms: item.duration,
                    }
                  : {
                      package_name: item.packageName,
                      package_version: item.packageVersion,
                      success: false,
                      error_code: item.error.code,
                      error_message: item.error.message,
                    }
              )
            ),
          });

          setResults(batchResults);
          updateBatchSessionResults(id, batchResults);
        },
        onError: (error) => {
          trackEvent("batch_analysis", {
            package_count: session.current?.packages.length ?? 0,
            success_count: 0,
            failure_count: session.current?.packages.length ?? 0,
            total_duration_ms: 0,
            avg_duration_ms: 0,
            error_code: error.message
              .toLowerCase()
              .includes("too many requests")
              ? "rate_limited"
              : "transport_error",
            error_message: error.message,
            packages_json: JSON.stringify(
              session.current?.packages.map((item) => ({
                package_name: item.name,
                package_version: item.version ?? "latest",
              })) ?? []
            ),
          });

          const msg = error.message.toLowerCase();
          if (
            msg.includes("too many requests") ||
            (msg.includes("unexpected token") && msg.includes("not valid json"))
          ) {
            toast.error("Too many requests. Please try again in a minute.");
          } else if (
            msg.includes("at most") &&
            msg.includes("array")
          ) {
            toast.error(
              "This package.json has too many dependencies for batch analysis. Please keep it to 30 or fewer."
            );
          } else {
            toast.error("Something went wrong. Please try again.");
          }
          void navigate({ to: "/" });
        },
      }
    );
  }, []);

  const analyzed = results
    .filter(isSuccess)
    .sort((a, b) => b.sizes.gzip - a.sizes.gzip);
  const failed = results.filter(isFailure);

  const handleItemClick = (item: AnalyzeBatchItem) => {
    if (!isSuccess(item)) return;
    const splat = buildSplat({
      name: item.packageName,
      version: item.packageVersion,
    });
    void navigate({ to: `/package/${splat}` });
  };

  const showResults = results.length > 0;

  return (
    <div className="relative flex min-h-svh flex-col items-center px-4 pt-10 pb-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-10 flex items-center gap-3"
      >
        <a href="/" className="flex items-center gap-3 group">
          <img
            src="/logo-nobg.png"
            alt="SizePanic"
            width={32}
            height={32}
            className="drop-shadow-md transition-transform group-hover:scale-105"
          />
          <span className="font-mono text-lg font-bold tracking-tighter text-foreground/80 group-hover:text-foreground transition-colors">
            SizePanic
          </span>
        </a>
      </motion.div>

      <div className="w-full max-w-3xl flex-1 flex flex-col justify-center pb-10">
        <AnimatePresence mode="wait">
          {analyzeMutation.isPending && !showResults && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <HugeiconsIcon
                    icon={Loading02Icon}
                    size={34}
                    strokeWidth={1.5}
                    className="relative text-foreground/70"
                  />
                </motion.div>
              </div>
              <p className="mt-4 font-mono text-sm text-foreground/50">
                analyzing {session.current?.packages.length ?? 0} packages...
              </p>
              <div className="mt-3 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="size-1 rounded-full bg-foreground/25"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {showResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-4"
            >
              <div className="mb-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => router.history.back()}
                  className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/" })}
                  className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <HugeiconsIcon
                    icon={Analytics03Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Analyze another package
                </button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/75 p-5 space-y-5">
                <div className="space-y-2.5">
                  {analyzed.map((item, index) => {
                    const githubUrl = repoToUrl(item.metadata.repository);

                    return (
                      <button
                        key={`${item.packageName}-${item.packageVersion}-${index}`}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="w-full cursor-pointer rounded-xl border border-border/65 bg-muted/15 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                      >
                        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-base font-bold tracking-tight text-foreground">
                              {item.packageName}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2">
                              <p className="font-mono text-xs text-primary">
                                @{item.packageVersion}
                              </p>
                              {item.isDevDependency && (
                                <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground/70">
                                  dev
                                </span>
                              )}
                            </div>
                          </div>

                          <StatsStrip
                            raw={formatBytes(item.sizes.raw)}
                            gzip={formatBytes(item.sizes.gzip)}
                            fast={formatMs(item.downloadTime.fast4G)}
                          />

                          <div
                            className="flex shrink-0 flex-col items-start gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {githubUrl && (
                              <TinyLinkRow
                                href={githubUrl}
                                icon={GithubIcon}
                                label="GitHub"
                              />
                            )}
                            <TinyLinkRow
                              href={item.metadata.npmUrl}
                              icon={NpmIcon}
                              label="Npm"
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {failed.length > 0 && (
                  <div className="pt-1 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <HugeiconsIcon
                        icon={PackageSearchIcon}
                        size={14}
                        strokeWidth={1.6}
                        className="text-destructive/80"
                      />
                      <p className="text-xs font-medium text-foreground/65">
                        Failed Packages
                      </p>
                    </div>

                    {failed.map((item, index) => (
                      <div
                        key={`${item.packageName}-${item.packageVersion}-${index}-failed`}
                        className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3"
                      >
                        <p className="font-mono text-sm font-bold tracking-tight text-foreground">
                          {item.packageName}
                          <span className="text-primary">
                            @{item.packageVersion}
                          </span>
                          {item.isDevDependency && (
                            <span className="ml-2 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground/70">
                              dev
                            </span>
                          )}
                        </p>
                        <div className="mt-1.5 rounded-lg border border-destructive/25 bg-background/70 px-2.5 py-2">
                          <p className="text-[11px] text-foreground/40 mb-0.5 uppercase">
                            ERROR
                          </p>
                          <p className="text-[11px] leading-relaxed text-destructive/85">
                            {item.error.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function isSuccess(item: AnalyzeBatchItem): item is AnalyzeSuccess {
  return "sizes" in item;
}

function isFailure(
  item: AnalyzeBatchItem
): item is Extract<
  AnalyzeBatchItem,
  { error: { code: string; message: string } }
> {
  return "error" in item;
}

function StatsStrip({
  raw,
  gzip,
  fast,
}: {
  raw: string;
  gzip: string;
  fast: string;
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border/55 bg-background/70 lg:min-w-[21rem]">
      <StatBlock label="RAW" value={raw} />
      <StatBlock label="GZIP" value={gzip} withDivider />
      <StatBlock label="4G" value={fast} withDivider />
    </div>
  );
}

function StatBlock({
  label,
  value,
  withDivider,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 ${withDivider ? "border-l border-border/55" : ""}`}
    >
      <p className="text-[11px] text-foreground/40 mb-0.5 uppercase">{label}</p>
      <p className="font-mono text-xs text-foreground/80">{value}</p>
    </div>
  );
}

function TinyLinkRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: IconSvgElement;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-background/70 text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-colors"
    >
      <HugeiconsIcon icon={icon} size={11} strokeWidth={1.7} />
    </a>
  );
}
