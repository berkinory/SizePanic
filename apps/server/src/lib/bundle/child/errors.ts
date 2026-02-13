export class BundleError extends Error {
  override name = "BundleError";
}

export class UnsupportedPackageError extends Error {
  override name = "UnsupportedPackageError";
}
