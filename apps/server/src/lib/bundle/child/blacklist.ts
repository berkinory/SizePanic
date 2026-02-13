export interface BlacklistRule {
  test: RegExp;
  reason: string;
}

const BLACKLIST: RegExp[] = [
  /^(webpack|vite|esbuild|rollup|parcel)$/,
  /^@(vitejs|rollup)\//,
  /^(nuxt|next|gatsby)$/,
  /^@(nuxt|remix-run)\//,
  /^(react-scripts|polymer-cli|razzle)$/,
  /-(webpack|rollup|vite)-plugin$/,
  /-loader$/,
  /^(yarn|npm|pnpm)$/,
  /^(react-icons|styled-icons|three)$/,
  /^@babylonjs\//,
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
  },
  {
    test: /^(next|nuxt|gatsby)$/,
    reason:
      "Meta-frameworks include build tools and are not meant to be bundled.",
  },
  {
    test: /^react-icons$/,
    reason: "This package is too large to analyze efficiently.",
  },
  {
    test: /^three$/,
    reason: "This 3D library is too large to analyze efficiently.",
  },
];

export function shouldSkipPackage(name: string): {
  skip: boolean;
  reason?: string;
} {
  const unsupported = UNSUPPORTED.find((r) => r.test.test(name));
  if (unsupported) return { skip: true, reason: unsupported.reason };
  if (BLACKLIST.some((p) => p.test(name)))
    return {
      skip: true,
      reason: "This package is not suitable for bundle size analysis",
    };
  return { skip: false };
}
