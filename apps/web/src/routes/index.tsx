import {
  GithubIcon,
  InformationCircleIcon,
  PackageSearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
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
import {
  buildSplat,
  fade,
  generateBatchId,
  GITHUB_URL,
  INPUT_EXAMPLES,
  INSTALL_TICKER,
  parseInput,
  parsePackageJsonFile,
  saveBatchSession,
  stagger,
  validatePackageJsonFile,
} from "@/lib/package";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageInput, setPackageInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);

  const parsedInput = parseInput(packageInput);
  const isInvalid = packageInput.trim().length > 0 && !parsedInput;

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedInput) return;
    void navigate({ to: `/package/${buildSplat(parsedInput)}` });
  };

  const applyExample = (value: string) => {
    const parsed = parseInput(value);
    if (!parsed) return;
    void navigate({ to: `/package/${buildSplat(parsed)}` });
  };

  const handleUpload = async (file: File | null | undefined) => {
    if (isParsingUpload) return;
    const validationError = validatePackageJsonFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsParsingUpload(true);
    try {
      const packages = await parsePackageJsonFile(file as File);
      if (packages.length === 0) {
        toast.error("No dependencies found in package.json");
        return;
      }
      const batchId = generateBatchId();
      saveBatchSession(batchId, { packages });
      void navigate({ to: "/batch/$id", params: { id: batchId } });
    } catch {
      toast.error("Could not parse package.json");
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleBoxClick = () => fileInputRef.current?.click();

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
    if (e.dataTransfer.files.length !== 1) {
      toast.error("Drop exactly one package.json file");
      return;
    }
    await handleUpload(e.dataTransfer.files[0]);
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
              disabled={!parsedInput}
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
          <div
            className={cn(
              "group border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
              isParsingUpload && "pointer-events-none opacity-50",
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
              accept="application/json,.json"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
