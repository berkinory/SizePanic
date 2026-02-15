import {
  GithubIcon,
  InformationCircleIcon,
  PackageSearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

const VERSION_RE = /^[\d.*x^~>=< ||-]+/;

type PackageInput = { name: string; version?: string };

type AnalyzeSuccess = {
  packageName: string;
  packageVersion: string;
  sizes: { raw: number; gzip: number; brotli: number };
  downloadTime: { slow3G: number; fast4G: number };
  duration: number;
};

type AnalyzeBatchItem =
  | AnalyzeSuccess
  | {
      packageName: string;
      packageVersion: string;
      error: { code: string; message: string };
    };

type ViewState = "entry" | "single" | "batch";

function parseInput(raw: string): PackageInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex > 0) {
    const name = trimmed.slice(0, atIndex);
    const version = trimmed.slice(atIndex + 1);
    if (version !== "latest" && !VERSION_RE.test(version)) return null;
    return { name, version };
  }

  return { name: trimmed };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function parsePackageJsonFile(file: File): Promise<PackageInput[]> {
  const content = await file.text();
  const parsed = JSON.parse(content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const merged = {
    ...(parsed.dependencies ?? {}),
    ...(parsed.devDependencies ?? {}),
  };

  return Object.entries(merged)
    .slice(0, 50)
    .map(([name, version]) => {
      if (typeof version !== "string") return { name };
      return { name, version };
    });
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const fade = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const GITHUB_URL = "https://github.com/berkinory/SizePanic";

const INSTALL_TICKER = [
  "react 3.1 kB",
  "@tanstack/react-query 13.6 kB",
  "date-fns 18.3 kB",
  "lodash 26.6 kB",
  "zod 61.1 kB",
];

const INPUT_EXAMPLES = ["react", "@tanstack/react-query"];

export default function PackageSearch() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageInput, setPackageInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const [view, setView] = useState<ViewState>("entry");
  const [singleResult, setSingleResult] = useState<AnalyzeSuccess | null>(null);
  const [batchResults, setBatchResults] = useState<AnalyzeBatchItem[]>([]);
  const [singleFromBatch, setSingleFromBatch] = useState(false);

  const parsedInput = parseInput(packageInput);
  const isInvalid = packageInput.trim().length > 0 && !parsedInput;
  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());
  const isLoading = analyzeMutation.isPending || isParsingUpload;

  const handleBoxClick = () => fileInputRef.current?.click();

  const runSingleAnalyze = async (input: PackageInput) => {
    try {
      const result = await analyzeMutation.mutateAsync({
        packageName: input.name,
        packageVersion: input.version,
      });
      if (Array.isArray(result)) return;
      setSingleFromBatch(false);
      setSingleResult(result as AnalyzeSuccess);
      setView("single");
    } catch {
      // QueryClient onError handles error toast.
    }
  };

  const runBatchAnalyze = async (packages: PackageInput[]) => {
    if (packages.length === 0) {
      toast.error("No dependencies found in package.json");
      return;
    }
    try {
      const result = await analyzeMutation.mutateAsync({
        packages: packages.map((item) => ({
          packageName: item.name,
          packageVersion: item.version,
        })),
      });
      if (!Array.isArray(result)) return;
      setBatchResults(result as AnalyzeBatchItem[]);
      setView("batch");
    } catch {
      // QueryClient onError handles error toast.
    }
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedInput || isLoading) return;
    await runSingleAnalyze(parsedInput);
  };

  const applyExample = async (value: string) => {
    setPackageInput(value);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const parsed = parseInput(value);
    if (!parsed || isLoading) return;
    await runSingleAnalyze(parsed);
  };

  const handleUpload = async (file: File | null | undefined) => {
    if (!file?.name.endsWith(".json") || isLoading) return;
    setPackageInput("");
    setIsParsingUpload(true);
    try {
      const packages = await parsePackageJsonFile(file);
      await runBatchAnalyze(packages);
    } catch {
      toast.error("Could not parse package.json");
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleUpload(e.dataTransfer.files[0]);
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="w-full max-w-lg"
    >
      <motion.div variants={fade} className="text-center mb-10">
        <h1 className="font-mono text-5xl font-bold tracking-tighter text-foreground">
          SizePanic
        </h1>
        <p className="text-foreground/60 mt-3 text-base">
          check what that npm install really costs
        </p>
        <div className="relative mt-5 overflow-hidden rounded-lg border border-border/60 bg-background/70 py-2">
          <motion.div
            className="flex w-max gap-2 px-2"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          >
            {[...INSTALL_TICKER, ...INSTALL_TICKER].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-foreground/70"
              >
                {item}
              </span>
            ))}
          </motion.div>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-xs text-foreground/40 hover:text-foreground transition-colors"
        >
          <HugeiconsIcon icon={GithubIcon} size={16} strokeWidth={1.5} />
          Star on GitHub
        </a>
      </motion.div>

      <div className="relative min-h-[20rem]">
        <motion.div
          animate={{ opacity: isLoading ? 0.2 : 1, filter: isLoading ? "blur(1px)" : "blur(0px)" }}
          transition={{ duration: 0.2 }}
          className={cn(isLoading && "pointer-events-none")}
        >
          {view === "entry" && (
            <>
              <motion.div variants={fade} className="space-y-2">
                <div className="hidden sm:flex items-center justify-between">
                  <TooltipProvider delay={0}>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/30 hover:text-foreground/60 transition-colors cursor-default">
                        Supported formats
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          size={14}
                          strokeWidth={1.5}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="rounded-lg border bg-background text-foreground py-2.5 px-3"
                      >
                        <div className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
                          <span>name</span>
                          <span>name/subpath</span>
                          <span>name@version</span>
                          <span>semver ranges (^, ~, &gt;=, *, latest)</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <form onSubmit={handleInputSubmit} className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 font-mono text-lg text-foreground/45 tracking-tight">
                    $ npm i
                  </span>
                  <Input
                    autoFocus
                    value={packageInput}
                    onChange={(e) => {
                      setPackageInput(e.target.value);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    placeholder="<react@latest>"
                    className={cn(
                      "h-14 rounded-xl border pl-[6.2rem] pr-12 font-mono text-lg! tracking-tight",
                      isInvalid
                        ? "border-destructive/50 ring-2 ring-destructive/20"
                        : "border-border"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={!parsedInput || isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground/80 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <HugeiconsIcon
                      icon={PackageSearchIcon}
                      size={24}
                      strokeWidth={1.5}
                    />
                  </button>
                </form>

                <div className="mt-1 flex flex-wrap gap-1.5">
                  {INPUT_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => void applyExample(example)}
                      className="cursor-pointer rounded-md border border-dashed border-border/70 bg-muted/20 px-2.5 py-1 font-mono text-[11px] text-foreground/80 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fade} className="flex items-center gap-4 my-8">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-foreground/20 uppercase tracking-[0.2em] select-none">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </motion.div>

              <motion.div variants={fade}>
                <div
                  className={cn(
                    "group border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
                    isDragging
                      ? "border-primary/60 bg-primary/5 scale-[1.01]"
                      : "border-border hover:border-foreground/20 hover:bg-muted/30"
                  )}
                  onClick={handleBoxClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => void handleDrop(e)}
                >
                  <div className="mb-4 rounded-full bg-muted/60 p-4 transition-colors group-hover:bg-muted">
                    <Upload className="size-5 text-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Drop your package.json
                  </p>
                  <p className="text-[13px] text-foreground/40 mt-1.5">
                    or{" "}
                    <label
                      htmlFor="fileUpload"
                      className="text-primary hover:text-primary/80 font-medium cursor-pointer underline underline-offset-2 decoration-primary/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      browse files
                    </label>
                  </p>
                  <input
                    type="file"
                    id="fileUpload"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={(e) => void handleUpload(e.target.files?.[0])}
                  />
                </div>
              </motion.div>
            </>
          )}

          {view === "single" && singleResult && (
            <motion.div variants={fade} className="rounded-xl border border-border p-5 space-y-4">
              <div>
                <p className="font-mono text-sm text-foreground/80">
                  {singleResult.packageName}@{singleResult.packageVersion}
                </p>
                <p className="text-xs text-foreground/45 mt-1">
                  analyzed in {singleResult.duration} ms
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/70 py-2">
                  <p className="text-[10px] uppercase text-foreground/40">gzip</p>
                  <p className="font-mono text-sm">{formatBytes(singleResult.sizes.gzip)}</p>
                </div>
                <div className="rounded-lg border border-border/70 py-2">
                  <p className="text-[10px] uppercase text-foreground/40">brotli</p>
                  <p className="font-mono text-sm">{formatBytes(singleResult.sizes.brotli)}</p>
                </div>
                <div className="rounded-lg border border-border/70 py-2">
                  <p className="text-[10px] uppercase text-foreground/40">raw</p>
                  <p className="font-mono text-sm">{formatBytes(singleResult.sizes.raw)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                {singleFromBatch ? (
                  <button
                    type="button"
                    onClick={() => setView("batch")}
                    className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors"
                  >
                    Back to batch
                  </button>
                ) : (
                  <span className="text-foreground/30">single result</span>
                )}
                <button
                  type="button"
                  onClick={() => setView("entry")}
                  className="cursor-pointer text-foreground/60 hover:text-foreground transition-colors"
                >
                  New analysis
                </button>
              </div>
            </motion.div>
          )}

          {view === "batch" && (
            <motion.div variants={fade} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/40">Batch results</p>
                <button
                  type="button"
                  onClick={() => setView("entry")}
                  className="text-xs cursor-pointer text-foreground/60 hover:text-foreground transition-colors"
                >
                  New analysis
                </button>
              </div>
              <div className="max-h-80 overflow-auto space-y-1.5">
                {batchResults.map((item, index) => (
                  <button
                    key={`${item.packageName}-${item.packageVersion}-${index}`}
                    type="button"
                    onClick={() => {
                      if (!("sizes" in item)) return;
                      setSingleResult(item);
                      setSingleFromBatch(true);
                      setView("single");
                    }}
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

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <Loader2 className="size-10 animate-spin text-foreground/70" />
            <p className="mt-3 font-mono text-sm text-foreground/50">analyzing...</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
