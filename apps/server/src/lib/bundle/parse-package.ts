export interface ParsedPackage {
  name: string;
  subpath?: string;
}

export function parsePackageName(raw: string): ParsedPackage {
  const isScoped = raw.startsWith("@");
  const segments = raw.split("/");

  const nameSegmentCount = isScoped ? 2 : 1;
  const name = segments.slice(0, nameSegmentCount).join("/");
  const rest = segments.slice(nameSegmentCount).join("/");

  return {
    name,
    subpath: rest ? `./${rest}` : undefined,
  };
}
