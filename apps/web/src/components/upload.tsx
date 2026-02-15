import {
  GithubIcon,
  InformationCircleIcon,
  PackageSearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import { FileJson, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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

function parseInput(raw: string): {
  name: string;
  version?: string;
} | null {
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

const INPUT_EXAMPLES = [
  "react",
  "@tanstack/react-query",
];

type AnalyzeMode = "input" | "upload";

export default function PackageSearch() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageInput, setPackageInput] = useState("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<AnalyzeMode>("input");
  const parsedInput = parseInput(packageInput);
  const isInvalid = packageInput.trim().length > 0 && !parsedInput;
  const analyzeMutation = useMutation(trpc.bundle.analyze.mutationOptions());

  const handleBoxClick = () => fileInputRef.current?.click();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".json")) {
      setMode("upload");
      setPackageInput("");
      setDroppedFile(file);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.name.endsWith(".json")) {
      setMode("upload");
      setPackageInput("");
      setDroppedFile(file);
    }
  };

  const removeFile = () => {
    setMode("input");
    setDroppedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyExample = (value: string) => {
    setMode("input");
    if (droppedFile) removeFile();
    setPackageInput(value);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode !== "input" || !parsedInput || analyzeMutation.isPending) return;

    let nextName = parsedInput.name;
    let nextVersion = parsedInput.version ?? "latest";

    try {
      const result = await analyzeMutation.mutateAsync({
        packageName: parsedInput.name,
        packageVersion: parsedInput.version,
      });
      if (!Array.isArray(result)) {
        nextName = result.packageName;
        nextVersion = result.packageVersion;
      }
    } catch {
      // QueryClient onError handler already shows an error toast.
    }

    window.location.assign(
      `/analyze/${encodeURIComponent(nextName)}/${encodeURIComponent(nextVersion)}`
    );
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

      <motion.div variants={fade} className="space-y-2">
        <div className="hidden sm:flex items-center justify-between">
          <TooltipProvider delay={0}>
            <Tooltip>
              <TooltipTrigger className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground/30 hover:text-foreground/60 transition-colors cursor-default">
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
              setMode("input");
              setPackageInput(e.target.value);
              if (droppedFile) removeFile();
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
            disabled={!parsedInput || analyzeMutation.isPending}
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
              onClick={() => applyExample(example)}
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
        {!droppedFile ? (
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
            onDrop={handleDrop}
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
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="border border-border rounded-xl px-4 py-3.5 flex items-center gap-4"
          >
            <div className="rounded-lg bg-muted p-3">
              <FileJson className="size-5 text-foreground/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground font-mono truncate">
                {droppedFile.name}
              </p>
              <p className="text-xs text-foreground/40 mt-0.5">
                {(droppedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-foreground/40 hover:text-destructive"
              onClick={removeFile}
            >
              <X className="size-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
