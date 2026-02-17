import {
  Analytics03Icon,
  ArrowLeft01Icon,
  CellularNetworkIcon,
  DeliveryBox02Icon,
  FlowConnectionIcon,
  GithubIcon,
  Loading02Icon,
  LicenseIcon,
  LinkSquare02Icon,
  NpmIcon,
  PackageOpenIcon,
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
import { useEffect } from "react";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type AnalyzeFailure,
  type AnalyzeSuccess,
  buildSplat,
  fade,
  formatBytes,
  formatMs,
  parseInput,
  repoToUrl,
  stagger,
} from "@/lib/package";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/package/$")({
  component: PackagePage,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function PackagePage() {
  const { _splat } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const parsed = _splat ? parseInput(_splat) : null;

  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());

  useEffect(() => {
    if (!parsed) {
      void navigate({ to: "/" });
      return;
    }

    analyzeMutation.mutate(
      {
        packageName: parsed.name,
        packageVersion: parsed.version,
      },
      {
        onError: (error) => {
          const msg = error.message.toLowerCase();
          if (
            msg.includes("too many requests") ||
            (msg.includes("unexpected token") && msg.includes("not valid json"))
          ) {
            toast.error("Too many requests. Please try again in a minute.");
            void navigate({ to: "/" });
          }
        },
      }
    );
  }, [parsed?.name, parsed?.version]);

  const result =
    analyzeMutation.data && !Array.isArray(analyzeMutation.data)
      ? "error" in analyzeMutation.data
        ? null
        : (analyzeMutation.data as AnalyzeSuccess)
      : null;

  const failure =
    analyzeMutation.data &&
    !Array.isArray(analyzeMutation.data) &&
    "error" in analyzeMutation.data
      ? (analyzeMutation.data as AnalyzeFailure)
      : null;

  const fallbackErrorMessage = normalizeErrorMessage(
    analyzeMutation.error?.message
  );

  if (!parsed) return null;

  const phase = analyzeMutation.isPending
    ? "loading"
    : result
      ? "result"
      : failure || analyzeMutation.isError
        ? "error"
        : "loading";

  return (
    <div className="relative flex min-h-svh flex-col items-center px-4 pt-10">
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

      <div className="w-full max-w-2xl flex-1 flex flex-col justify-center pb-16">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
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
                    size={36}
                    strokeWidth={1.5}
                    className="relative text-foreground/70"
                  />
                </motion.div>
              </div>
              <p className="mt-4 font-mono text-sm text-foreground/50">
                analyzing {parsed.name}...
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

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(160deg,rgba(220,38,38,0.08)_0%,rgba(220,38,38,0.03)_38%,rgba(0,0,0,0)_100%)] p-6 sm:p-7"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-destructive/10 blur-3xl" />

              <div className="relative mb-5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => router.history.back()}
                  className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
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
                  className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <HugeiconsIcon
                    icon={Analytics03Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                  Analyze another package
                </button>
              </div>

              <div className="relative space-y-5">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] text-destructive/85">
                    <HugeiconsIcon
                      icon={PackageOpenIcon}
                      size={13}
                      strokeWidth={1.8}
                    />
                    Analysis Failed
                  </span>
                  <p className="font-mono text-base text-foreground/90 sm:text-lg">
                    {_splat}
                  </p>
                </div>

                <div className="rounded-xl border border-destructive/20 bg-background/75 px-3.5 py-3 backdrop-blur-sm">
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {failure?.error.message ?? fallbackErrorMessage}
                  </p>
                </div>

                {!failure && analyzeMutation.isError && (
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-xs text-foreground/65">
                    <p className="font-medium text-foreground/75">
                      Possible reason
                    </p>
                    <p className="mt-1 leading-relaxed">
                      NPM veya API rate limitine takildigin icin sunucudan
                      beklenen JSON yerine text donmus olabilir.
                    </p>
                  </div>
                )}
              </div>

              {failure?.error.subpaths && failure.error.subpaths.length > 0 && (
                <div className="relative mt-5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <HugeiconsIcon
                      icon={PackageSearchIcon}
                      size={15}
                      strokeWidth={1.5}
                      className="text-foreground/50"
                    />
                    <span className="text-xs tracking-wide text-foreground/55 font-medium">
                      Available Exports
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-background/60">
                    <ScrollArea className="max-h-34">
                      <div className="space-y-1 p-2 pr-3">
                        {failure.error.subpaths.map((subpath) => (
                          <button
                            key={subpath}
                            type="button"
                            onClick={() =>
                              void navigate({
                                to: `/package/${buildSplat({ name: `${failure.packageName}/${subpath}` })}`,
                              })
                            }
                            className="flex w-full cursor-pointer items-center rounded-lg border border-border/55 bg-muted/20 px-3 py-1.5 font-mono text-xs text-foreground/75 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors"
                          >
                            {failure.packageName}/{subpath}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <ResultCard result={result} requestedName={parsed.name} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function normalizeErrorMessage(message: string | undefined): string {
  if (!message) return "Something went wrong while analyzing this package.";

  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("too many requests")) {
    return "Too many requests. Please try again in a minute.";
  }

  if (
    lowerMessage.includes("unexpected token") &&
    lowerMessage.includes("not valid json")
  ) {
    return "Too many requests. Please try again in a minute.";
  }

  return message;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function ResultCard({
  result,
  requestedName,
}: {
  result: AnalyzeSuccess;
  requestedName: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();

  const githubUrl = repoToUrl(result.metadata.repository);
  const hasLinks =
    githubUrl || result.metadata.homepage || result.metadata.npmUrl;
  const subpaths = result.metadata.subpaths.filter((s) => s !== "package.json");

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div
        variants={fade}
        className="flex items-center justify-between text-xs"
      >
        <button
          type="button"
          onClick={() => router.history.back()}
          className="cursor-pointer text-foreground/50 hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.5} />
          Back
        </button>
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          className="cursor-pointer text-foreground/50 hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <HugeiconsIcon icon={Analytics03Icon} size={14} strokeWidth={1.5} />
          Analyze another package
        </button>
      </motion.div>

      <motion.div variants={fade}>
        <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {requestedName}
          <span className="text-primary">@{result.packageVersion}</span>
        </h1>
      </motion.div>

      <motion.div
        variants={fade}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/50"
      >
        {result.metadata.license && (
          <span className="inline-flex items-center gap-1">
            <HugeiconsIcon
              icon={LicenseIcon}
              size={13}
              strokeWidth={1.5}
              className="text-foreground/30"
            />
            {result.metadata.license}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <HugeiconsIcon
            icon={PackageOpenIcon}
            size={13}
            strokeWidth={1.5}
            className="text-foreground/30"
          />
          {pluralize(
            result.metadata.dependencyCount,
            "dependency",
            "dependencies"
          )}
        </span>
        {result.metadata.peerDependencyCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <HugeiconsIcon
              icon={FlowConnectionIcon}
              size={13}
              strokeWidth={1.5}
              className="text-foreground/30"
            />
            {pluralize(
              result.metadata.peerDependencyCount,
              "peer dependency",
              "peer dependencies"
            )}
          </span>
        )}
      </motion.div>

      {hasLinks && (
        <motion.div variants={fade} className="flex items-center gap-1.5">
          <ExternalChip
            href={result.metadata.npmUrl}
            icon={NpmIcon}
            label="npm"
          />
          {githubUrl && (
            <ExternalChip href={githubUrl} icon={GithubIcon} label="GitHub" />
          )}
          {result.metadata.homepage && (
            <ExternalChip
              href={result.metadata.homepage}
              icon={LinkSquare02Icon}
              label="Home"
            />
          )}
        </motion.div>
      )}

      <motion.div
        variants={fade}
        className="rounded-xl border border-border bg-muted/20 p-4 space-y-4"
      >
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <HugeiconsIcon
              icon={DeliveryBox02Icon}
              size={15}
              strokeWidth={1.5}
              className="text-foreground/50"
            />
            <span className="text-xs uppercase tracking-wider text-foreground/50 font-medium">
              Bundle size
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SizeCell label="RAW" bytes={result.sizes.raw} />
            <SizeCell
              label="GZIP"
              bytes={result.sizes.gzip}
              savings={Math.round(
                (1 - result.sizes.gzip / result.sizes.raw) * 100
              )}
            />
          </div>
        </div>

        <div className="h-px bg-border/60" />

        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <HugeiconsIcon
              icon={CellularNetworkIcon}
              size={15}
              strokeWidth={1.5}
              className="text-foreground/50"
            />
            <span className="text-xs uppercase tracking-wider text-foreground/50 font-medium">
              Download time
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
              <p className="text-[11px] text-foreground/40 mb-0.5">SLOW 3G</p>
              <p className="font-mono text-sm text-foreground/80">
                {formatMs(result.downloadTime.slow3G)}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
              <p className="text-[11px] text-foreground/40 mb-0.5">FAST 4G</p>
              <p className="font-mono text-sm text-foreground/80">
                {formatMs(result.downloadTime.fast4G)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {subpaths.length > 0 && (
        <motion.div variants={fade} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={PackageSearchIcon}
              size={15}
              strokeWidth={1.5}
              className="text-foreground/50"
            />
            <span className="text-xs uppercase tracking-wider text-foreground/50 font-medium">
              Subpaths
            </span>
          </div>
          <ScrollArea className="max-h-34">
            <div className="space-y-1">
              {subpaths.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: `/package/${buildSplat({ name: `${result.packageName}/${sub}` })}`,
                    })
                  }
                  className="flex w-full cursor-pointer items-center rounded-md border border-border/50 bg-muted/15 px-3 py-1.5 font-mono text-xs text-foreground/60 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors"
                >
                  {result.packageName}/{sub}
                </button>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      )}
    </motion.div>
  );
}

function SizeCell({
  label,
  bytes,
  savings,
}: {
  label: string;
  bytes: number;
  savings?: number;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
      <p className="text-[11px] text-foreground/40 mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="font-mono text-sm text-foreground/80">
          {formatBytes(bytes)}
        </p>
        {savings != null && savings > 0 && (
          <span className="font-mono text-[11px] text-green-500">
            -{savings}%
          </span>
        )}
      </div>
    </div>
  );
}

function ExternalChip({
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
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-colors"
    >
      <HugeiconsIcon icon={icon} size={13} strokeWidth={1.5} />
      {label}
    </a>
  );
}
