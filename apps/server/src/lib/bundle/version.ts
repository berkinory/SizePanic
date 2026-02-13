import { NPM_REGISTRY_URL } from "./constants";
import { parsePackageName } from "./parse-package";

interface NpmPackageMeta {
  "dist-tags": {
    latest: string;
    [tag: string]: string;
  };
}

export async function resolveVersion(
  packageName: string,
  version: string | undefined
): Promise<string> {
  if (!version || version === "latest") {
    const { name } = parsePackageName(packageName);
    const res = await fetch(`${NPM_REGISTRY_URL}/${name}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
    });

    if (!res.ok) {
      throw new Error(`Package "${name}" not found`);
    }

    const meta = (await res.json()) as NpmPackageMeta;
    return meta["dist-tags"].latest;
  }

  return version;
}
