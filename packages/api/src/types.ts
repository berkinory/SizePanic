export interface BundleSizes {
  raw: number;
  gzip: number;
  brotli: number;
}

export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  keywords?: string[];
  dependencyCount: number;
  peerDependencyCount: number;
  npmUrl: string;
  subpaths: string[];
}

export interface BundleRequest {
  packageName: string;
  packageVersion: string;
  subpath?: string;
  jobId: string;
}

export interface BundleResult {
  success: true;
  sizes: BundleSizes;
  metadata: PackageMetadata;
  duration: number;
  jobId: string;
  timestamp: number;
}

export type BundleErrorCode =
  | "TIMEOUT"
  | "SIZE_LIMIT_EXCEEDED"
  | "FETCH_FAILED"
  | "INSTALL_FAILED"
  | "BUNDLE_FAILED"
  | "UNSUPPORTED_PACKAGE"
  | "NODE_BUILTIN_MODULES"
  | "NO_ENTRY_POINT"
  | "UNKNOWN";

export interface BundleError {
  success: false;
  error: {
    code: BundleErrorCode;
    message: string;
    subpaths?: string[];
  };
  duration: number;
  packageName: string;
  packageVersion: string;
  jobId: string;
  timestamp: number;
}

export type BundleResponse = BundleResult | BundleError;
