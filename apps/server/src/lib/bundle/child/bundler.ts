import { existsSync } from "node:fs";
import { join } from "node:path";

import { createEntryPoint } from "./entry-point";
import { BundleError } from "./errors";

interface PackageJson {
  main?: string;
  module?: string;
  exports?: Record<string, unknown> | string;
  browser?: string | Record<string, unknown>;
  name?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function bundlePackage(
  packageDir: string,
  subpath?: string
): Promise<string> {
  const pkg = (await Bun.file(
    join(packageDir, "package.json")
  ).json()) as PackageJson;
  const externals = extractAllDependencies(pkg);

  try {
    const code = await bundleWithSyntheticEntry(
      packageDir,
      pkg.name || "unknown",
      subpath,
      externals
    );
    if (code.length >= 100) return code;
  } catch {}

  return bundleWithPackageResolution(packageDir, pkg, subpath, externals);
}

function extractAllDependencies(pkg: PackageJson): string[] {
  const deps = new Set<string>();
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
    "devDependencies",
  ] as const) {
    if (pkg[field]) Object.keys(pkg[field]!).forEach((d) => deps.add(d));
  }
  return Array.from(deps);
}

async function bundleWithSyntheticEntry(
  packageDir: string,
  packageName: string,
  subpath: string | undefined,
  externals: string[]
): Promise<string> {
  const entryPath = createEntryPoint({
    packageName: subpath ? `${packageName}/${subpath}` : packageName,
    packageDir,
  });

  const result = await Bun.build({
    entrypoints: [entryPath],
    minify: true,
    target: "browser",
    format: "esm",
    external: externals,
    define: { "process.env.NODE_ENV": '"production"' },
  });

  if (!result.success) {
    throw new BundleError(
      result.logs
        .filter((l) => l.level === "error")
        .map((l) => l.message)
        .join(", ") || "unknown error"
    );
  }

  return result.outputs[0]?.text() || "";
}

async function bundleWithPackageResolution(
  packageDir: string,
  pkg: PackageJson,
  subpath: string | undefined,
  externals: string[]
): Promise<string> {
  const entryPoint = subpath
    ? resolveSubpathExport(pkg, subpath)
    : resolveEntryPoint(pkg);
  if (!entryPoint) {
    throw new BundleError(
      subpath
        ? `Subpath "${subpath}" is not exported by this package`
        : noEntryMessage(pkg)
    );
  }

  const entryPath = join(packageDir, entryPoint);
  if (!existsSync(entryPath)) {
    throw new BundleError(
      subpath
        ? `Subpath "${subpath}" resolved to "${entryPoint}" but the file was not found`
        : noEntryMessage(pkg)
    );
  }

  let finalPath = entryPath;
  const content = await Bun.file(entryPath).text();
  if (
    content.includes("process.env.NODE_ENV") &&
    content.includes("module.exports") &&
    content.includes("require(")
  ) {
    const prodPath = resolveProductionBuild(packageDir, content);
    if (prodPath) finalPath = prodPath;
  }

  const result = await Bun.build({
    entrypoints: [finalPath],
    minify: true,
    target: "browser",
    format: "esm",
    external: externals,
    define: { "process.env.NODE_ENV": '"production"' },
  });

  if (!result.success) {
    const errors = result.logs
      .filter((l) => l.level === "error")
      .map((l) => l.message);
    const missing = parseMissingModules(errors);

    if (missing.length > 0 && missing.length <= 10) {
      const newExternals = [...new Set([...externals, ...missing])];
      if (newExternals.length > externals.length) {
        return bundleWithPackageResolution(
          packageDir,
          pkg,
          subpath,
          newExternals
        );
      }
    }

    throw new BundleError(errors.join(", ") || "unknown error");
  }

  return result.outputs[0]?.text() || "";
}

function parseMissingModules(errors: string[]): string[] {
  const modules = new Set<string>();
  for (const msg of errors) {
    const match = msg.match(/Could not resolve:\s*['"]([^'"]+)['"]/i);
    if (match?.[1]) {
      const pkgName = match[1].startsWith("@")
        ? match[1].split("/").slice(0, 2).join("/")
        : match[1].split("/")[0];
      if (pkgName) modules.add(pkgName);
    }
  }
  return Array.from(modules);
}

function resolveEntryPoint(pkg: PackageJson): string | null {
  if (pkg.exports) {
    const entry = resolveExports(pkg.exports);
    if (entry) return entry;
  }
  if (pkg.module) return pkg.module;
  if (typeof pkg.browser === "string") return pkg.browser;
  if (pkg.main) return pkg.main;
  if (pkg.exports && typeof pkg.exports === "object") return null;
  return "index.js";
}

function resolveProductionBuild(dir: string, content: string): string | null {
  for (const match of content.matchAll(/require\(['"](.+?)['"]\)/g)) {
    if (match[1]?.includes("production")) {
      const fullPath = join(dir, match[1]);
      if (existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

function resolveExports(
  exports: Record<string, unknown> | string
): string | null {
  if (typeof exports === "string") return exports;
  const dotExport = exports["."];
  if (typeof dotExport === "string") return dotExport;
  if (dotExport && typeof dotExport === "object") {
    const record = dotExport as Record<string, unknown>;
    const path = record.import ?? record.default ?? record.browser;
    if (typeof path === "string") return path;
    if (path && typeof path === "object") {
      const nested = path as Record<string, unknown>;
      if (typeof nested.default === "string") return nested.default;
    }
  }
  return null;
}

function resolveSubpathExport(
  pkg: PackageJson,
  subpath: string
): string | null {
  if (!pkg.exports || typeof pkg.exports === "string") return null;
  const entry = pkg.exports[subpath];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const resolved = record.import ?? record.default ?? record.browser;
    if (typeof resolved === "string") return resolved;
    if (resolved && typeof resolved === "object") {
      const nested = resolved as Record<string, unknown>;
      if (typeof nested.default === "string") return nested.default;
    }
  }
  return null;
}

function noEntryMessage(pkg: PackageJson): string {
  const subpaths =
    pkg.exports && typeof pkg.exports === "object"
      ? Object.keys(pkg.exports).filter((k) => k !== "." && k.startsWith("./"))
      : [];

  if (subpaths.length > 0) {
    return `Package doesn't have a default export. Try using a subpath, e.g. ${pkg.name}/${subpaths[0]!.slice(2)}`;
  }
  return `Package doesn't have a recognizable entry point. It may be a CLI tool, a types-only package, or use a non-standard build.`;
}
