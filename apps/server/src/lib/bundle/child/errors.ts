export class BundleError extends Error {
  override name = "BundleError";
}

export class UnsupportedPackageError extends Error {
  override name = "UnsupportedPackageError";
}

export class NodeBuiltinError extends Error {
  override name = "NodeBuiltinError";
}

export class NoEntryPointError extends Error {
  override name = "NoEntryPointError";

  constructor(
    message: string,
    readonly subpaths: string[] = []
  ) {
    super(message);
  }
}

export class InstallError extends Error {
  override name = "InstallError";
}

export class SizeLimitError extends Error {
  override name = "SizeLimitError";
}
