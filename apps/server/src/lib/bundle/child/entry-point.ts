import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function createEntryPoint(options: {
  packageName: string;
  packageDir: string;
  includeDefault?: boolean;
}): string {
  const entryPath = join(options.packageDir, "__bundle_entry__.js");
  const lines = [`export * from '${options.packageName}';`];
  if (options.includeDefault !== false) {
    lines.push(`export { default } from '${options.packageName}';`);
  }
  writeFileSync(entryPath, lines.join("\n"), "utf-8");
  return entryPath;
}
