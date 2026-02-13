import type { PackageMetadata } from "@SizePanic/api";

import { NPM_REGISTRY_URL } from "../constants";

interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: string | { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  time: { [version: string]: string };
}

export async function fetchMetadata(
  packageName: string,
  packageVersion: string
): Promise<PackageMetadata> {
  const infoUrl = `${NPM_REGISTRY_URL}/${packageName}/${packageVersion}`;
  const res = await fetch(infoUrl);

  if (!res.ok) {
    throw new FetchError(
      `Failed to fetch package info: ${res.status} ${res.statusText}`
    );
  }

  const info = (await res.json()) as NpmPackageInfo;
  const publishedAt = info.time?.[info.version] || new Date().toISOString();

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
    publishedAt,
  };
}

export class FetchError extends Error {
  override name = "FetchError";
}
