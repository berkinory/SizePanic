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
}
