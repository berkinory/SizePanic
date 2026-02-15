import { valid, validRange } from "semver";

export function resolveVersion(
  _packageName: string,
  version: string | undefined
): string {
  if (!version || version === "latest") {
    return "latest";
  }

  if (valid(version) || validRange(version)) {
    return version;
  }

  throw new Error(`Invalid version: "${version}"`);
}
