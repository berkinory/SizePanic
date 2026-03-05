import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { parseInput } from "@/lib/package";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/badges")({
  component: BadgeGeneratorPage,
});

type BadgeStyle = "flat" | "flat-square" | "plastic" | "for-the-badge";
type BadgeMetric = "minified" | "brotli" | "min";

const API_BASE = "https://api.sizepanic.com";
const SHIELDS_BASE = "https://img.shields.io/endpoint";

function BadgeGeneratorPage() {
  const [packageName, setPackageName] = useState("react");
  const [debouncedPackageName, setDebouncedPackageName] = useState("react");
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>("flat-square");
  const [badgeMetric, setBadgeMetric] = useState<BadgeMetric>("minified");
  const [logo, setLogo] = useState("");
  const [badgeLabel, setBadgeLabel] = useState("");
  const [badgeColor, setBadgeColor] = useState("3fb950");
  const [badgeLabelColor, setBadgeLabelColor] = useState("30363d");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedPackageName(packageName);
    }, 500);

    return () => clearTimeout(timeout);
  }, [packageName]);

  const parsedInput = parseInput(debouncedPackageName);
  const isValidName = Boolean(parsedInput);

  const apiUrl = useMemo(() => {
    if (!parsedInput) return "";
    const encodedPath = parsedInput.name
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const params = new URLSearchParams({ type: badgeMetric });
    if (parsedInput.version) {
      params.set("version", parsedInput.version);
    }
    if (badgeLabel.trim()) {
      params.set("label", badgeLabel.trim());
    }
    if (badgeColor.trim()) {
      params.set("color", badgeColor.trim());
    }
    if (badgeLabelColor.trim()) {
      params.set("labelColor", badgeLabelColor.trim());
    }
    return `${API_BASE}/badge/${encodedPath}?${params.toString()}`;
  }, [parsedInput, badgeMetric, badgeLabel, badgeColor, badgeLabelColor]);

  const shieldsUrl = useMemo(() => {
    if (!apiUrl) return "";

    const [rawBase, query = ""] = apiUrl.split("?");
    const base = rawBase || apiUrl;
    const shieldsParams = new URLSearchParams();
    shieldsParams.set("url", query ? `${base}?${query}` : base);
    shieldsParams.set("style", badgeStyle);

    if (logo.trim()) shieldsParams.set("logo", logo.trim());

    return `${SHIELDS_BASE}?${shieldsParams.toString()}`;
  }, [apiUrl, badgeStyle, logo]);

  const badgeMarkdown = useMemo(() => {
    if (!shieldsUrl) return "";
    return `![SizePanic badge](${shieldsUrl})`;
  }, [shieldsUrl]);

  return (
    <div className="relative min-h-svh overflow-hidden px-4 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_15%,var(--primary)_0%,transparent_50%),radial-gradient(ellipse_at_80%_70%,var(--primary)_0%,transparent_55%)] opacity-[0.06]" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative mx-auto w-full max-w-4xl"
      >
        <div className="mb-7 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-foreground/60 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
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
                    "h-12 rounded-xl font-mono",
                    !isValidName &&
                      "border-destructive/40 ring-2 ring-destructive/20"
                  )}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Badge Style
                  </span>
                  <div className="grid h-12 grid-cols-2 rounded-lg border border-border/70 bg-muted/30 p-1">
                    {(
                      [
                        "for-the-badge",
                        "flat-square",
                        "flat",
                        "plastic",
                      ] as const
                    ).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setBadgeStyle(item)}
                        className={cn(
                          "cursor-pointer rounded-md font-mono text-[11px] transition-all",
                          badgeStyle === item
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/60 hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </label>

                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Size Metric
                  </span>
                  <div className="grid h-12 grid-cols-3 rounded-lg border border-border/70 bg-muted/30 p-1">
                    {(
                      [
                        ["minified", "Min+Gzip"],
                        ["brotli", "Min+Brotli"],
                        ["min", "Min"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBadgeMetric(value)}
                        className={cn(
                          "cursor-pointer rounded-md font-mono text-[11px] transition-all",
                          badgeMetric === value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/60 hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </label>

                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Left Label
                  </span>
                  <Input
                    value={badgeLabel}
                    onChange={(event) => setBadgeLabel(event.target.value)}
                    placeholder="bundle size"
                    className="h-12 rounded-xl font-mono"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Left Color
                  </span>
                  <Input
                    value={badgeLabelColor}
                    onChange={(event) => setBadgeLabelColor(event.target.value)}
                    placeholder="30363d or black"
                    className="h-12 rounded-xl font-mono"
                  />
                </label>

                <label>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-xs text-foreground/55">
                      Size Logo
                    </span>
                    <a
                      href="https://simpleicons.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary transition-colors hover:text-primary/80"
                    >
                      All Icons
                    </a>
                  </div>
                  <Input
                    value={logo}
                    onChange={(event) => setLogo(event.target.value)}
                    placeholder="blank, npm, react, github"
                    className="h-12 rounded-xl font-mono"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                    Right Color
                  </span>
                  <Input
                    value={badgeColor}
                    onChange={(event) => setBadgeColor(event.target.value)}
                    placeholder="3fb950 or brightgreen"
                    className="h-12 rounded-xl font-mono"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <span className="mb-1.5 block font-mono text-xs text-foreground/55">
                  Preview
                </span>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex min-h-6 items-center">
                    {shieldsUrl ? (
                      <img
                        src={shieldsUrl}
                        alt="Generated package size badge"
                        className="h-5"
                      />
                    ) : (
                      <p className="font-mono text-xs text-foreground/45">
                        Enter a valid package name.
                      </p>
                    )}
                  </div>
                  <code className="mt-3 block max-h-24 overflow-auto break-all rounded-md border border-border/70 bg-background/80 p-2 font-mono text-[11px] text-foreground/80">
                    {badgeMarkdown || "-"}
                  </code>
                </div>
              </div>
            </section>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
