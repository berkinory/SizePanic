export interface BlacklistRule {
  test: RegExp;
  reason: string;
  allowSubpaths?: boolean;
}

const BLACKLIST: RegExp[] = [
  /^@(vitejs|rollup)\//,
  /^(react-scripts|polymer-cli|razzle)$/,
  /-(webpack|rollup|vite)-plugin$/,
  /-loader$/,
  /^(yarn|npm|pnpm)$/,
  /^devextreme$/,
  /hack-cheats|hacks?-cheats?|hack-unlimited|generator-unlimited|hack-\d+|cheat-\d+|-hacks?-/,
];

const UNSUPPORTED: BlacklistRule[] = [
  {
    test: /^@types\//,
    reason: "Type packages don't usually contain any runtime code.",
  },
  {
    test: /^(webpack|vite|esbuild|rollup|parcel)$/,
    reason:
      "Build tools are not meant to be bundled - they're used to create bundles.",
    allowSubpaths: true,
  },
  {
    test: /^(next|nuxt|gatsby)$/,
    reason:
      "Meta-frameworks include build tools and are not meant to be bundled.",
    allowSubpaths: true,
  },
  {
    test: /^@(nuxt|remix-run)\//,
    reason:
      "Meta-framework packages include build tools and are not meant to be bundled.",
    allowSubpaths: true,
  },
];

export function shouldSkipPackage(
  name: string,
  subpath?: string
): {
  skip: boolean;
  reason?: string;
} {
  const hasSubpath = !!subpath;
  const unsupported = UNSUPPORTED.find((r) => r.test.test(name));
  if (unsupported && !(hasSubpath && unsupported.allowSubpaths)) {
    return { skip: true, reason: unsupported.reason };
  }
  if (BLACKLIST.some((p) => p.test(name)))
    return {
      skip: true,
      reason: "This package is not suitable for bundle size analysis",
    };
  return { skip: false };
}
