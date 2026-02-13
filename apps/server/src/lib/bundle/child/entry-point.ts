import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function createEntryPoint(options: {
  packageName: string;
  packageDir: string;
}): string {
  const entryPath = join(options.packageDir, "__bundle_entry__.js");
  writeFileSync(
    entryPath,
    `export * from '${options.packageName}';
export { default } from '${options.packageName}';`,
    "utf-8"
  );
  return entryPath;
}
