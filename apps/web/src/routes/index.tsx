import {
  GithubIcon,
  InformationCircleIcon,
  PackageSearchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  FileText,
  Gauge,
  Layers,
  Upload,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
  MAX_BATCH_PACKAGE_COUNT,
  parseInput,
  parsePackageJsonFile,
  saveBatchSession,
  stagger,
  validatePackageJsonFile,
} from "@/lib/package";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomeComponent,
  head: () => ({}),
});

function HomeComponent() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [packageInput, setPackageInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("BATCH_LIMIT_EXCEEDED:")
      ) {
        toast.error(
          `This package.json has too many dependencies for batch analysis. Please keep it to ${MAX_BATCH_PACKAGE_COUNT} or fewer.`
        );
        return;
      }

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
    <div className="relative flex flex-col items-center px-4 pt-10">
      <div className="pointer-events-none absolute inset-0 h-svh bg-[radial-gradient(ellipse_at_50%_40%,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />

      <div className="flex min-h-svh flex-col items-center justify-center w-full">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="w-full max-w-lg"
        >
          <motion.div variants={fade} className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-3">
              <img
                src="/logo-nobg.png"
                alt="SizePanic"
                width={56}
                height={56}
                className="drop-shadow-lg"
              />
              <h1 className="font-mono text-5xl font-bold tracking-tighter text-foreground">
                SizePanic
              </h1>
            </div>
            <p className="text-foreground/60 mt-3 text-base">
              npm package size analyzer - check what that install really costs
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
                placeholder="<drizzle-orm>"
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
            <motion.div
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-300",
                isParsingUpload && "pointer-events-none opacity-50",
                isDragging
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/70 hover:border-foreground/20 hover:bg-muted/20"
              )}
              onClick={handleBoxClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => void handleDrop(e)}
              animate={isDragging ? { scale: 1.015 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,var(--primary)_0%,transparent_70%)] transition-opacity duration-500",
                  isDragging
                    ? "opacity-[0.06]"
                    : "opacity-0 group-hover:opacity-[0.03]"
                )}
              />

              <div className="relative flex flex-col items-center">
                <motion.div
                  className={cn(
                    "mb-4 rounded-2xl border p-4 transition-colors duration-300",
                    isDragging
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/50 bg-muted/50 group-hover:border-foreground/10 group-hover:bg-muted/80"
                  )}
                  animate={
                    isDragging ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Upload
                    className={cn(
                      "size-6 transition-colors duration-300",
                      isDragging
                        ? "text-primary"
                        : "text-foreground/30 group-hover:text-foreground/50"
                    )}
                  />
                </motion.div>

                <p className="font-mono text-sm font-medium text-foreground">
                  Drop your package.json
                </p>
                <p className="mt-1.5 text-xs text-foreground/40">
                  or{" "}
                  <label
                    htmlFor="fileUpload"
                    className="text-primary hover:text-primary/80 font-medium cursor-pointer underline underline-offset-2 decoration-primary/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    browse files
                  </label>{" "}
                  to analyze all dependencies at once.
                </p>
              </div>

              <input
                type="file"
                id="fileUpload"
                ref={fileInputRef}
                className="hidden"
                accept="application/json,.json"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
            </motion.div>
          </motion.div>

          <motion.div variants={fade} className="mt-12 flex justify-center">
            <ChevronDown className="size-5 text-foreground/20 animate-bounce" />
          </motion.div>
        </motion.div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-3xl py-24"
      >
        <h2 className="font-mono text-2xl font-bold tracking-tight text-foreground text-center mb-4">
          Know the real cost before you ship
        </h2>
        <p className="text-foreground/50 text-center text-sm max-w-md mx-auto mb-14">
          Every dependency adds weight. SizePanic shows you exactly how much
          each package costs your users in bytes and load time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.4,
                delay: i * 0.08,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              whileHover={{ y: -2 }}
              className="group rounded-xl border border-border/60 bg-muted/10 p-5 transition-colors hover:border-border hover:bg-muted/20"
            >
              <div className="mb-3 inline-flex rounded-lg bg-muted/60 p-2.5 transition-colors group-hover:bg-muted">
                <feature.icon className="size-4 text-foreground/50 transition-colors group-hover:text-foreground/70" />
              </div>
              <h3 className="font-mono text-sm font-medium text-foreground mb-1.5">
                {feature.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/45">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-2xl pb-24"
      >
        <h2 className="font-mono text-2xl font-bold tracking-tight text-foreground text-center mb-12">
          Frequently asked questions
        </h2>

        <div className="divide-y divide-border/60">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={item.q} className="py-5 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between text-left font-mono text-sm font-medium text-foreground"
                >
                  {item.q}
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{
                      duration: 0.2,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <ChevronDown className="size-4 shrink-0 text-foreground/30" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: 0.25,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                      className="overflow-hidden"
                    >
                      <p className="pt-3 text-[13px] leading-relaxed text-foreground/50 pr-8">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl border-t border-border/40 py-8 text-center"
      >
        <p className="font-mono text-xs text-foreground/25">
          SizePanic - open source npm package size analyzer
        </p>
      </motion.footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Gauge,
    title: "Estimated package sizes",
    description:
      "Packages are installed and bundled with Bun in isolation. You get estimated minified and gzip sizes close to what your users will download.",
  },
  {
    icon: Zap,
    title: "Download time estimates",
    description:
      "See how long each package takes to download on slow 3G and fast 4G connections so you can make informed decisions.",
  },
  {
    icon: FileText,
    title: "Batch analysis",
    description:
      "Upload your package.json and analyze every dependency at once. Get a full breakdown of your project's bundle footprint.",
  },
  {
    icon: Layers,
    title: "Version and subpath support",
    description:
      "Analyze any version, semver range, or deep import subpath. Compare sizes across versions to catch regressions.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does SizePanic measure package size?",
    a: "Each package is installed in an isolated environment and bundled using Bun's built-in bundler with minification enabled. We then measure the raw and gzip-compressed output sizes to give you an estimated cost close to what your users will actually download.",
  },
  {
    q: "Can I analyze all dependencies in my project at once?",
    a: "Yes. Drop your package.json file onto SizePanic and it will analyze every dependency and devDependency in a single batch, showing individual and total bundle sizes.",
  },
  {
    q: "Does it support scoped packages and specific versions?",
    a: "Yes. You can search for scoped packages like @tanstack/react-query, specific versions like react@18.2.0, and semver ranges like lodash@^4.0.0.",
  },
  {
    q: "Is SizePanic free and open source?",
    a: "Yes. SizePanic is completely free to use and the source code is available on GitHub. No sign-up or API key required.",
  },
];
