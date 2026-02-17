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
  /^(devextreme|syncfusion|@grapecity|@progress\/kendo)$/,
  /hack-cheats|hacks?-cheats?|hack-unlimited|generator-unlimited|hack-\d+|cheat-\d+|-hacks?-/,
];

const UNSUPPORTED: BlacklistRule[] = [
  {
    test: /^@types\//,
    reason: "Type packages don't usually contain any runtime code.",
  },
  {
    test: /^@.+\/types$/,
    reason: "Type-only packages don't contain any runtime code.",
  },
  {
    test: /^types-/,
    reason: "Type-only packages don't contain any runtime code.",
  },
  {
    test: /^(bun|node|web|react|react-native|deno|cloudflare|css|hast|mdast|unist|estree|geojson|topojson)-types$/,
    reason: "Type-only packages don't contain any runtime code.",
  },
  {
    test: /^(webpack|vite|esbuild|rollup|parcel|turbo|lerna|nx)$/,
    reason: "Build tools and monorepo managers are not meant to be bundled.",
    allowSubpaths: true,
  },
  {
    test: /^(typescript|ts-node|babel-core|@babel\/core|swc|@swc\/core)$/,
    reason:
      "Compilers and transpilers are development tools, not runtime libraries.",
  },
  {
    test: /^(jest|vitest|mocha|chai|cypress|playwright|puppeteer|ava|karma|jasmine)$/,
    reason:
      "Testing frameworks and runners should not be included in production bundles.",
  },
  {
    test: /^(eslint|prettier|stylelint|jshint|tslint|@eslint|@typescript-eslint)/,
    reason: "Linters and formatters are development tools.",
  },
  {
    test: /^(aws-sdk|googleapis|azure-sdk|@azure|@google-cloud)/,
    reason:
      "Monolithic SDKs are too large. Use modular imports (e.g. @aws-sdk/client-s3) instead.",
  },
  {
    test: /^(jsdom|canvas|sharp|phantomjs|selenium-webdriver|puppeteer-core)$/,
    reason:
      "Packages relying on heavy native bindings or browser simulation are not suitable for browser bundles.",
  },
  {
    test: /^(sqlite3|better-sqlite3|pg-native|oracledb|libsql|turso)$/,
    reason: "Native database drivers cannot be bundled for the browser.",
  },
  {
    test: /^(prisma|@prisma\/client)$/,
    reason: "ORMs with native bindings cannot be bundled for the browser.",
  },
  {
    test: /^(@biomejs\/biome|oxlint|oxc-parser|ts-morph|jscodeshift|node-gyp|node-pre-gyp)$/,
    reason: "Native CLI tools and compilers cannot be bundled for the browser.",
  },
  {
    test: /^(electron|tauri|nw\.js)$/,
    reason: "Desktop application frameworks cannot be bundled for the web.",
  },
  {
    test: /^(pm2|nodemon|forever|concurrently|npm-run-all|cross-env)$/,
    reason:
      "Server process managers and CLI utilities are not runtime libraries.",
  },
  {
    test: /^(fsevents|chokidar|watchman)$/,
    reason:
      "File system watchers rely on native bindings and cannot be bundled.",
  },
  {
    test: /^(cpu-features|microtime|bufferutil|utf-8-validate)$/,
    reason: "Native addon packages cannot be bundled for the browser.",
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
