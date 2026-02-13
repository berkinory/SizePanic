import type { PackageMetadata } from "@SizePanic/api";

import {
  MAX_EXTRACTED_SIZE,
  MAX_TARBALL_SIZE,
  NPM_REGISTRY_URL,
} from "../constants";

interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: string | { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  author?: string | { name: string; email?: string };
  maintainers?: { name: string; email: string }[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  time: { [version: string]: string };
  dist: {
    tarball: string;
    unpackedSize?: number;
  };
}

interface PackageJson {
  types?: string;
  typings?: string;
}

function extractMetadata(
  info: NpmPackageInfo,
  _pkg?: PackageJson
): PackageMetadata {
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

export async function fetchTarball(
  packageName: string,
  packageVersion: string
): Promise<{ tarball: Buffer; metadata: PackageMetadata; tarballUrl: string }> {
  const infoUrl = `${NPM_REGISTRY_URL}/${packageName}/${packageVersion}`;

  const infoRes = await fetch(infoUrl);

  if (!infoRes.ok) {
    throw new FetchError(
      `Failed to fetch package info: ${infoRes.status} ${infoRes.statusText}`
    );
  }

  const info = (await infoRes.json()) as NpmPackageInfo;

  if (info.dist.unpackedSize && info.dist.unpackedSize > MAX_EXTRACTED_SIZE) {
    throw new SizeLimitError(
      `Unpacked size ${info.dist.unpackedSize} exceeds limit ${MAX_EXTRACTED_SIZE}`
    );
  }

  const tarballUrl = info.dist.tarball;
  const tarballRes = await fetch(tarballUrl);

  if (!tarballRes.ok) {
    throw new FetchError(
      `Failed to fetch tarball: ${tarballRes.status} ${tarballRes.statusText}`
    );
  }

  const contentLength = tarballRes.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_TARBALL_SIZE) {
    throw new SizeLimitError(
      `Tarball size ${contentLength} exceeds limit ${MAX_TARBALL_SIZE}`
    );
  }

  const arrayBuffer = await tarballRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > MAX_TARBALL_SIZE) {
    throw new SizeLimitError(
      `Tarball size ${buffer.byteLength} exceeds limit ${MAX_TARBALL_SIZE}`
    );
  }

  const metadata = extractMetadata(info);

  return { tarball: buffer, metadata, tarballUrl };
}

export class FetchError extends Error {
  override name = "FetchError";
}

export class SizeLimitError extends Error {
  override name = "SizeLimitError";
}
