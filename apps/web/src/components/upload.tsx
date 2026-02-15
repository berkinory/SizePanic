import { GithubIcon, PackageSearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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

export default function PackageSearch() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageInput, setPackageInput] = useState("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    if (file?.name.endsWith(".json")) setDroppedFile(file);
  };

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (file?.name.endsWith(".json")) setDroppedFile(file);
  };

  const removeFile = () => {
    setDroppedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        <div className="flex items-center justify-between">
          <TooltipProvider delay={0}>
            <Tooltip>
              <TooltipTrigger className="text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors cursor-default">
                Supported formats
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

        <form onSubmit={(e) => e.preventDefault()} className="relative">
          <Input
            value={packageInput}
            onChange={(e) => setPackageInput(e.target.value)}
            placeholder="analyze package"
            className="h-14 rounded-xl pl-5 pr-12 font-mono text-lg!"
          />
          <button
            type="submit"
            disabled={!parseInput(packageInput)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground/80 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <HugeiconsIcon
              icon={PackageSearchIcon}
              size={24}
              strokeWidth={1.5}
            />
          </button>
        </form>
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
