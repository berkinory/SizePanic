const VERSION_RE = /^[\d.*x^~>=< ||-]+/;
const MAX_PACKAGE_JSON_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_BATCH_PACKAGE_COUNT = 50;
const ALLOWED_PACKAGE_JSON_MIME_TYPES = new Set([
  "application/json",
  "text/json",
  "text/plain",
  "",
]);
const NON_NPM_PROTOCOL_PREFIXES = ["workspace:", "file:", "link:", "portal:"];

export type PackageInput = {
  name: string;
  version?: string;
  isDevDependency?: boolean;
};

export type AnalyzeSuccess = {
  packageName: string;
  packageVersion: string;
  isDevDependency?: boolean;
  sizes: { raw: number; gzip: number; brotli: number };
  downloadTime: { slow3G: number; fast4G: number };
  duration: number;
  metadata: {
    name: string;
    version: string;
    description?: string;
    license?: string;
    repository?: { type: string; url: string };
    homepage?: string;
    keywords?: string[];
    dependencyCount: number;
    peerDependencyCount: number;
    npmUrl: string;
    subpaths: string[];
  };
};

export type AnalyzeBatchItem =
  | AnalyzeSuccess
  | {
      packageName: string;
      packageVersion: string;
      isDevDependency?: boolean;
      error: { code: string; message: string; subpaths?: string[] };
    };

export type AnalyzeFailure = {
  packageName: string;
  packageVersion: string;
  isDevDependency?: boolean;
  error: { code: string; message: string; subpaths?: string[] };
};

type UploadedPackageJson = {
  name?: string;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  workspaces?: {
    catalog?: Record<string, unknown>;
  };
  catalog?: Record<string, unknown>;
  pnpm?: {
    catalog?: Record<string, unknown>;
  };
};

export function parseInput(raw: string): PackageInput | null {
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

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function repoToUrl(
  repo: { type: string; url: string } | undefined
): string | null {
  if (!repo?.url) return null;
  return repo.url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => typeof entry === "string") as [
      string,
      string,
    ][]
  );
}

function getCatalogMap(parsed: UploadedPackageJson): Record<string, string> {
  return {
    ...toStringRecord(parsed.catalog),
    ...toStringRecord(parsed.pnpm?.catalog),
    ...toStringRecord(parsed.workspaces?.catalog),
  };
}

function normalizeDependencyVersion(
  packageName: string,
  rawVersion: string,
  catalogMap: Record<string, string>
): string | null {
  if (
    NON_NPM_PROTOCOL_PREFIXES.some((prefix) => rawVersion.startsWith(prefix))
  ) {
    return null;
  }

  if (rawVersion === "latest" || VERSION_RE.test(rawVersion)) return rawVersion;

  if (rawVersion.startsWith("catalog:")) {
    const catalogKey =
      rawVersion.slice("catalog:".length).trim() || packageName;
    const catalogVersion = catalogMap[catalogKey];
    if (!catalogVersion) return "latest";
    if (
      NON_NPM_PROTOCOL_PREFIXES.some((prefix) =>
        catalogVersion.startsWith(prefix)
      )
    ) {
      return null;
    }
    if (catalogVersion === "latest" || VERSION_RE.test(catalogVersion)) {
      return catalogVersion;
    }
    return "latest";
  }

  return "latest";
}

export function validatePackageJsonFile(
  file: File | null | undefined
): string | null {
  if (!file) return "No file selected";
  if (file.name !== "package.json") {
    return "Only package.json files are allowed";
  }
  if (file.size === 0) return "package.json is empty";
  if (file.size > MAX_PACKAGE_JSON_SIZE_BYTES) {
    return "package.json must be 5 MB or smaller";
  }
  if (!ALLOWED_PACKAGE_JSON_MIME_TYPES.has(file.type)) {
    return "Invalid file type for package.json";
  }
  return null;
}

export async function parsePackageJsonFile(
  file: File
): Promise<PackageInput[]> {
  const content = await file.text();
  const parsed = JSON.parse(content) as UploadedPackageJson;
  const catalogMap = getCatalogMap(parsed);

  const dependencies = toStringRecord(parsed.dependencies);
  const devDependencies = toStringRecord(parsed.devDependencies);
  const merged = new Map<
    string,
    { version: string; isDevDependency: boolean }
  >();

  for (const [name, version] of Object.entries(dependencies)) {
    const normalizedVersion = normalizeDependencyVersion(
      name,
      version,
      catalogMap
    );
    if (!normalizedVersion) continue;
    merged.set(name, { version: normalizedVersion, isDevDependency: false });
  }

  for (const [name, version] of Object.entries(devDependencies)) {
    if (merged.has(name)) continue;
    const normalizedVersion = normalizeDependencyVersion(
      name,
      version,
      catalogMap
    );
    if (!normalizedVersion) continue;
    merged.set(name, { version: normalizedVersion, isDevDependency: true });
  }

  if (merged.size > MAX_BATCH_PACKAGE_COUNT) {
    throw new Error(
      `BATCH_LIMIT_EXCEEDED:${merged.size}:${MAX_BATCH_PACKAGE_COUNT}`
    );
  }

  return Array.from(merged.entries()).map(([name, value]) => ({
    name,
    version: value.version,
    isDevDependency: value.isDevDependency,
  }));
}

export function buildSplat(input: PackageInput): string {
  return input.version ? `${input.name}@${input.version}` : input.name;
}

export const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

export const fade = {
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

export const GITHUB_URL = "https://github.com/berkinory/SizePanic";

export const INSTALL_TICKER = [
  "react 3.1 kB",
  "@tanstack/react-query 13.6 kB",
  "date-fns 18.3 kB",
  "lodash 26.6 kB",
  "zod 61.1 kB",
];

export const INPUT_EXAMPLES = ["react", "@tanstack/react-query"];

export type BatchSessionData = {
  packages: PackageInput[];
  results?: AnalyzeBatchItem[];
};

export function generateBatchId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function saveBatchSession(id: string, data: BatchSessionData): void {
  sessionStorage.setItem(`batch:${id}`, JSON.stringify(data));
}

export function loadBatchSession(id: string): BatchSessionData | null {
  const raw = sessionStorage.getItem(`batch:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BatchSessionData;
  } catch {
    return null;
  }
}

export function updateBatchSessionResults(
  id: string,
  results: AnalyzeBatchItem[]
): void {
  const session = loadBatchSession(id);
  if (!session) return;
  session.results = results;
  saveBatchSession(id, session);
}
