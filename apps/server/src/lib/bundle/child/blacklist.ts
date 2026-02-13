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
  /^(yarn|npm|pnpm|bun)$/,
  /^devextreme$/,
  /hack-cheats|hacks?-cheats?|hack-unlimited|generator-unlimited|hack-\d+|cheat-\d+|-hacks?-/,
];

const UNSUPPORTED: BlacklistRule[] = [
  {
    test: /^@types\//,
    reason: "Type packages don't usually contain any runtime code.",
  },
  {
    test: /^(webpack|vite|esbuild|rollup|parcel|turbo|lerna|nx)$/,
    reason:
      "Build tools and monorepo managers are not meant to be bundled.",
    allowSubpaths: true,
  },
  {
    test: /^(typescript|ts-node|babel-core|@babel\/core|swc|@swc\/core)$/,
    reason: "Compilers and transpilers are development tools, not runtime libraries.",
  },
  {
    test: /^(jest|vitest|mocha|chai|cypress|playwright|puppeteer|ava|karma|jasmine)$/,
    reason: "Testing frameworks and runners should not be included in production bundles.",
  },
  {
    test: /^(eslint|prettier|stylelint|jshint|tslint|@eslint|@typescript-eslint)/,
    reason: "Linters and formatters are development tools.",
  },
  {
    test: /^(aws-sdk|googleapis|azure-sdk|@azure|@google-cloud)/,
    reason: "Monolithic SDKs are too large. Use modular imports (e.g. @aws-sdk/client-s3) instead.",
  },
  {
    test: /^(jsdom|canvas|sharp|phantomjs|selenium-webdriver)$/,
    reason: "Packages relying on heavy native bindings or browser simulation are not suitable for browser bundles.",
  },
  {
    test: /^(electron|tauri|nw\.js)$/,
    reason: "Desktop application frameworks cannot be bundled for the web.",
  },
  {
    test: /^(pm2|nodemon|forever)$/,
    reason: "Server process managers are not frontend libraries.",
  },
  {
    test: /^(next|nuxt|gatsby|astro|sapper|blitz|redwood)$/,
    reason:
      "Meta-frameworks include build tools and are not meant to be bundled directly.",
    allowSubpaths: true,
  },
  {
    test: /^@(nuxt|remix-run|astrojs|nestjs)\//,
    reason:
      "Framework-specific packages often include build tools and are not meant to be bundled.",
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
