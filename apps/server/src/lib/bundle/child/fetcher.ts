import type { PackageMetadata } from "@SizePanic/api";

import { join } from "node:path";

interface PackageJson {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: string | { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export async function readMetadata(
  workDir: string,
  packageName: string
): Promise<PackageMetadata> {
  const pkgPath = join(workDir, "node_modules", packageName, "package.json");
  const file = Bun.file(pkgPath);

  if (!(await file.exists())) {
    throw new FetchError(`Package.json not found at ${pkgPath}`);
  }

  const info = (await file.json()) as PackageJson;
  return mapPackageInfo(info);
}

function mapPackageInfo(info: PackageJson): PackageMetadata {
  let repository = info.repository;
  if (typeof repository === "string") {
    repository = { type: "git", url: repository };
  }

  return {
    name: info.name,
    version: info.version,
    description: info.description,
    license: info.license,
    repository,
    homepage: info.homepage,
    keywords: info.keywords,
    dependencyCount: Object.keys(info.dependencies || {}).length,
    peerDependencyCount: Object.keys(info.peerDependencies || {}).length,
  };
}

export class FetchError extends Error {
  override name = "FetchError";
}
