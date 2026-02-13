import { createEntryPoint } from "./entry-point";
import { BundleError, NodeBuiltinError } from "./errors";

export async function bundlePackage(
  workDir: string,
  packageName: string,
  subpath?: string,
  externals: string[] = []
): Promise<string> {
  const cleanSubpath = subpath?.replace(/^\.\//, "");
  const importPath = cleanSubpath
    ? `${packageName}/${cleanSubpath}`
    : packageName;

  const code = await tryBundle(workDir, importPath, externals, true);
  if (code !== null) return code;

  const fallback = await tryBundle(workDir, importPath, externals, false);
  if (fallback !== null) return fallback;

  throw new BundleError(
    "Bundle failed for both default and star-only export strategies"
  );
}

async function tryBundle(
  workDir: string,
  importPath: string,
  externals: string[],
  includeDefault: boolean
): Promise<string | null> {
  const entryPath = createEntryPoint({
    packageName: importPath,
    packageDir: workDir,
    includeDefault,
  });

  let result: Awaited<ReturnType<typeof Bun.build>>;
  try {
    result = await Bun.build({
      entrypoints: [entryPath],
      minify: true,
      target: "browser",
      format: "esm",
      external: externals,
      define: { "process.env.NODE_ENV": '"production"' },
    });
  } catch (e) {
    const messages = extractErrorMessages(e);
    if (includeDefault && messages.includes("No matching export")) return null;
    checkNodeBuiltin(messages);
    throw new BundleError(messages);
  }

  if (!result.success) {
    const errors = result.logs
      .filter((l) => l.level === "error")
      .map((l) => l.message);

    const joined = errors.join(", ");
    if (includeDefault && joined.includes("No matching export")) return null;
    checkNodeBuiltin(joined);
    throw new BundleError(joined || "unknown error");
  }

  return result.outputs[0]?.text() || "";
}

function extractErrorMessages(e: unknown): string {
  if (e instanceof AggregateError) {
    return e.errors.map((err: Error) => err.message).join(", ");
  }
  return e instanceof Error ? e.message : String(e);
}

function checkNodeBuiltin(msg: string): void {
  if (
    msg.includes("Browser build cannot import Node.js builtin") ||
    msg.includes("Browser build cannot require() Node.js builtin") ||
    msg.includes("Browser polyfill for module")
  ) {
    throw new NodeBuiltinError(
      "Package uses Node.js built-in modules and cannot be bundled for browsers. It's likely a server-side or CLI tool."
    );
  }
}
