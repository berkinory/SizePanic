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
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type AnalyzeBatchItem,
  type AnalyzeSuccess,
  buildSplat,
  fade,
  formatBytes,
  formatMs,
  loadBatchSession,
  repoToUrl,
  stagger,
  updateBatchSessionResults,
} from "@/lib/package";
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

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-4 w-full max-w-3xl"
      >
        <motion.div
          variants={fade}
          className="mb-3 flex items-center justify-between text-xs"
        >
          <button
            type="button"
            onClick={() => router.history.back()}
            className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.5} />
            Back
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <HugeiconsIcon icon={Analytics03Icon} size={14} strokeWidth={1.5} />
            Analyze another package
          </button>
        </motion.div>

        {analyzeMutation.isPending && (
          <motion.div
            variants={fade}
            className="flex flex-col items-center justify-center py-20"
          >
            <HugeiconsIcon
              icon={Loading02Icon}
              size={34}
              strokeWidth={1.5}
              className="animate-spin text-foreground/70"
            />
            <p className="mt-3 font-mono text-sm text-foreground/50">
              analyzing {session.current?.packages.length ?? 0} packages...
            </p>
          </motion.div>
        )}

        {results.length > 0 && (
          <motion.div
            variants={fade}
            className="rounded-2xl border border-border/70 bg-background/75 p-5 space-y-5"
          >
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
                        <p className="mt-0.5 font-mono text-xs text-primary">
                          @{item.packageVersion}
                        </p>
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
          </motion.div>
        )}
      </motion.div>
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
    <TooltipProvider>
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border/55 bg-background/70 lg:min-w-[21rem]">
        <StatBlock label="RAW" value={raw} />
        <StatBlock label="GZIP" value={gzip} withDivider />
        <div className="border-l border-border/55 px-2 py-1.5">
          <p className="text-[11px] text-foreground/40 mb-0.5 uppercase">
            SPEED
          </p>
          <Tooltip>
            <TooltipTrigger className="font-mono text-xs text-foreground/80 cursor-help">
              {fast}
            </TooltipTrigger>
            <TooltipContent>Fast 4G</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
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
