import { ArrowLeft, Check, Copy, ExternalLink, Shield } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/badges")({
  component: BadgeGeneratorPage,
});

type BadgeType = "gzip" | "brotli" | "raw";

const API_BASE = "https://api.sizepanic.com";
const SHIELDS_BASE = "https://img.shields.io/endpoint";

const EXAMPLES = [
  { name: "react", version: "", type: "gzip" as BadgeType },
  { name: "zod", version: "4.1.13", type: "brotli" as BadgeType },
];

function BadgeGeneratorPage() {
  const [packageName, setPackageName] = useState("react");
  const [version, setVersion] = useState("");
  const [type, setType] = useState<BadgeType>("gzip");
  const [copiedKey, setCopiedKey] = useState<"shields" | "markdown" | null>(
    null
  );

  const normalizedName = packageName.trim();
  const isValidName = normalizedName.length > 0 && !normalizedName.includes(" ");

  const apiUrl = useMemo(() => {
    if (!isValidName) return "";
    const encodedPath = normalizedName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const params = new URLSearchParams({ type });
    if (version.trim()) {
      params.set("version", version.trim());
    }
    return `${API_BASE}/badge/${encodedPath}?${params.toString()}`;
  }, [isValidName, normalizedName, type, version]);

  const shieldsUrl = useMemo(() => {
    if (!apiUrl) return "";
    return `${SHIELDS_BASE}?url=${encodeURIComponent(apiUrl)}`;
  }, [apiUrl]);

  const markdownSnippet = useMemo(() => {
    if (!shieldsUrl) return "";
    const versionPart = version.trim() ? ` ${version.trim()}` : "";
    return `![${normalizedName}${versionPart} ${type} size](${shieldsUrl})`;
  }, [normalizedName, shieldsUrl, type, version]);

  const handleCopy = async (value: string, key: "shields" | "markdown") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1200);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="relative min-h-svh overflow-hidden px-4 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_15%,var(--primary)_0%,transparent_50%),radial-gradient(ellipse_at_80%_70%,var(--primary)_0%,transparent_55%)] opacity-[0.06]" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mx-auto w-full max-w-4xl"
      >
        <div className="mb-7 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 font-mono text-xs text-foreground/70 transition-colors hover:border-border hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <a
            href="https://sizepanic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/45 transition-colors hover:text-foreground/75"
          >
            sizepanic.com
            <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 p-5 backdrop-blur-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-border/70 bg-muted/40 p-2.5">
              <Shield className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Badge Generator
              </h1>
              <p className="mt-1 text-sm text-foreground/55">
                Generate Shields badge URLs for SizePanic package metrics.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                  Package Name
                </span>
                <Input
                  value={packageName}
                  onChange={(event) => setPackageName(event.target.value)}
                  placeholder="@tanstack/react-query"
                  className={cn(
                    "h-12 font-mono",
                    !isValidName && "border-destructive/40 ring-2 ring-destructive/20"
                  )}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Version (optional)
                  </span>
                  <Input
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder="latest or 4.1.13"
                    className="h-12 font-mono"
                  />
                </label>
                <div>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Metric
                  </span>
                  <div className="grid h-12 grid-cols-3 rounded-lg border border-border/70 bg-muted/30 p-1">
                    {(["gzip", "brotli", "raw"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setType(item)}
                        className={cn(
                          "cursor-pointer rounded-md font-mono text-xs transition-all",
                          type === item
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/60 hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {EXAMPLES.map((example) => (
                  <button
                    key={`${example.name}-${example.version}-${example.type}`}
                    type="button"
                    onClick={() => {
                      setPackageName(example.name);
                      setVersion(example.version);
                      setType(example.type);
                    }}
                    className="cursor-pointer rounded-md border border-dashed border-border/70 bg-muted/20 px-2.5 py-1 font-mono text-[11px] text-foreground/75 transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    {example.name}
                    {example.version ? `@${example.version}` : ""} - {example.type}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">
                  Preview
                </p>
                {shieldsUrl ? (
                  <img
                    src={shieldsUrl}
                    alt="Generated package size badge"
                    className="h-5"
                  />
                ) : (
                  <p className="font-mono text-xs text-foreground/45">Enter a valid package name.</p>
                )}
              </div>

              <ResultRow
                label="Shields URL"
                value={shieldsUrl}
                onCopy={() => void handleCopy(shieldsUrl, "shields")}
                copied={copiedKey === "shields"}
              />

              <ResultRow
                label="Markdown"
                value={markdownSnippet}
                onCopy={() => void handleCopy(markdownSnippet, "markdown")}
                copied={copiedKey === "markdown"}
              />
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">
        {label}
      </p>
      <div className="flex items-start gap-2">
        <code className="max-h-24 flex-1 overflow-auto break-all rounded-md border border-border/70 bg-background/80 p-2 font-mono text-[11px] text-foreground/80">
          {value || "-"}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCopy}
          disabled={!value}
          className="cursor-pointer"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}
