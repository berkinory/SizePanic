import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseInput(raw: string): { name: string; version?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex > 0) {
    return {
      name: trimmed.slice(0, atIndex),
      version: trimmed.slice(atIndex + 1),
    };
  }

  return { name: trimmed };
}

const HomeComponent = () => {
  const [input, setInput] = useState("");

  const analyze = useMutation(
    trpc.bundle.analyze.mutationOptions({
      onError: (error) => {
        console.error(error.message);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInput(input);
    if (!parsed) return;

    analyze.mutate({
      packageName: parsed.name,
      packageVersion: parsed.version,
    });
  };

  const result = analyze.data;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">SizePanic</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            find the cost of adding a npm package
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="package or package@version"
            disabled={analyze.isPending}
          />
          <Button type="submit" disabled={analyze.isPending || !input.trim()}>
            {analyze.isPending ? "..." : "Analyze"}
          </Button>
        </form>

        {analyze.isError && (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {analyze.error.message}
          </div>
        )}

        {result && !Array.isArray(result) && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b pb-2">
              <span className="font-mono text-sm">
                {result.metadata.name}@{result.metadata.version}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatMs(result.duration)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {formatBytes(result.sizes.raw)}
                </div>
                <div className="text-xs text-muted-foreground">minified</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatBytes(result.sizes.gzip)}
                </div>
                <div className="text-xs text-muted-foreground">gzip</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatBytes(result.sizes.brotli)}
                </div>
                <div className="text-xs text-muted-foreground">brotli</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 text-center">
              <div>
                <div className="text-lg font-medium">
                  {formatMs(result.downloadTime.slow3G)}
                </div>
                <div className="text-xs text-muted-foreground">Slow 3G</div>
              </div>
              <div>
                <div className="text-lg font-medium">
                  {formatMs(result.downloadTime.fast4G)}
                </div>
                <div className="text-xs text-muted-foreground">4G</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
