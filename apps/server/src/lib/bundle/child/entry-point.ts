import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function createEntryPoint(options: {
  packageName: string;
  packageDir: string;
}): string {
  const entryPath = join(options.packageDir, "__bundle_entry__.js");
  writeFileSync(
    entryPath,
    `import * as p from '${options.packageName}'; console.log(p)`,
    "utf-8"
  );
  return entryPath;
}
