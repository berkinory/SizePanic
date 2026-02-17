import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { shouldSkipPackage } from "./child/blacklist";
import { parsePackageName } from "./parse-package";
import { resolveVersion } from "./version";

const versionSchema = z
  .string()
  .min(1)
  .refine((v) => v === "latest" || /^[\d.*x^~>=< ||-]+/.test(v), {
    message: "Version must be a valid semver version or range, or 'latest'",
  })
  .optional();

function zodOk(v: string | undefined): boolean {
  return versionSchema.safeParse(v).success;
}

describe("resolveVersion", () => {
  describe("latest / undefined", () => {
    it("returns 'latest' when version is undefined", () => {
      expect(resolveVersion("react", undefined)).toBe("latest");
    });

    it("returns 'latest' when version is 'latest'", () => {
      expect(resolveVersion("react", "latest")).toBe("latest");
    });

    it("returns 'latest' when version is empty string", () => {
      expect(resolveVersion("react", "")).toBe("latest");
    });
  });

  describe("exact versions", () => {
    const cases = [
      "1.0.0",
      "0.0.1",
      "18.2.0",
      "0.0.0",
      "100.200.300",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-beta.2",
      "1.0.0-rc.1",
      "2.0.0-next.1",
      "1.0.0+build.123",
      "0.0.0-0",
    ];

    for (const v of cases) {
      it(`accepts exact version: ${v}`, () => {
        expect(resolveVersion("pkg", v)).toBe(v);
      });
    }
  });

  describe("v-prefixed versions", () => {
    it("accepts v1.0.0 (semver.valid coerces it)", () => {
      expect(resolveVersion("pkg", "v1.0.0")).toBe("v1.0.0");
    });

    it("accepts v0.1.0", () => {
      expect(resolveVersion("pkg", "v0.1.0")).toBe("v0.1.0");
    });
  });

  describe("semver ranges", () => {
    const cases = [
      "^1.0.0",
      "^0.1.0",
      "^0.0.1",
      "~1.2.3",
      "~0.1.0",
      ">=1.0.0",
      ">1.0.0",
      "<=2.0.0",
      "<2.0.0",
      ">=1.0.0 <2.0.0",
      ">1.0.0 <=3.0.0",
      "1.0.0 - 2.0.0",
      "1.x",
      "1.2.x",
      "*",
      "1.*.*",
      "1.0.0 || 2.0.0",
      "^1.0.0 || ^2.0.0",
      ">=1.0.0 <2.0.0 || >=3.0.0",
      "^1.0.0-alpha",
      ">=1.0.0-beta.1",
      ">0.0.0",
    ];

    for (const v of cases) {
      it(`accepts range: ${v}`, () => {
        expect(resolveVersion("pkg", v)).toBe(v);
      });
    }
  });

  describe("invalid versions", () => {
    const cases = [
      "not-a-version",
      "abc",
      "hello world",
      "@#$%",
      "v1.0.0.0.0",
      "react",
      "latest123",
      "file:../local",
      "git+https://github.com/user/repo",
      "npm:alias@1.0.0",
      "https://evil.com",
      "javascript:alert(1)",
    ];

    for (const v of cases) {
      it(`rejects invalid: ${v}`, () => {
        expect(() => resolveVersion("pkg", v)).toThrow("Invalid version");
      });
    }
  });
});

describe("versionSchema", () => {
  describe("accepts valid inputs", () => {
    const valid = [
      undefined,
      "latest",
      "1.0.0",
      "0.0.1",
      "18.2.0",
      "^1.0.0",
      "~1.2.3",
      ">=1.0.0",
      ">1.0.0",
      "<=2.0.0",
      "<2.0.0",
      ">=1.0.0 <2.0.0",
      "1.x",
      "1.2.x",
      "*",
      "1.0.0 || 2.0.0",
      "1 - 2",
      "^1.0.0 || ^2.0.0",
    ];

    for (const v of valid) {
      it(`accepts: ${v === undefined ? "undefined" : v}`, () => {
        expect(zodOk(v)).toBe(true);
      });
    }
  });

  describe("rejects invalid inputs", () => {
    const invalid = [
      "",
      "abc",
      "not-a-version",
      "hello world",
      "@scope/pkg",
      "react",
      "file:../local",
      "git+https://github.com/user/repo",
      "npm:alias@1.0.0",
      "https://evil.com",
      "javascript:alert(1)",
    ];

    for (const v of invalid) {
      it(`rejects: ${v === "" ? "(empty string)" : v}`, () => {
        expect(zodOk(v)).toBe(false);
      });
    }
  });
});

describe("versionSchema + resolveVersion pipeline", () => {
  describe("Zod passes but resolveVersion catches", () => {
    const edgeCases = ["^", ">", "< >", "~^"];
    for (const v of edgeCases) {
      it(`"${v}" passes Zod but resolveVersion rejects`, () => {
        expect(zodOk(v)).toBe(true);
        expect(() => resolveVersion("pkg", v)).toThrow("Invalid version");
      });
    }
  });

  describe("Zod passes and semver treats as valid range", () => {
    const permissive = ["||", "   "];
    for (const v of permissive) {
      it(`"${v}" passes both (semver interprets as empty/any range)`, () => {
        expect(zodOk(v)).toBe(true);
        expect(() => resolveVersion("pkg", v)).not.toThrow();
      });
    }
  });

  describe("both accept valid ranges", () => {
    const valid = [
      "^1.0.0",
      "~2.3.4",
      ">=1.0.0 <2.0.0",
      "*",
      "1.x",
      "1.0.0 || 2.0.0",
    ];
    for (const v of valid) {
      it(`"${v}" passes both layers`, () => {
        expect(zodOk(v)).toBe(true);
        expect(() => resolveVersion("pkg", v)).not.toThrow();
      });
    }
  });

  describe("both reject garbage", () => {
    const garbage = ["abc", "react", "file:../local", "https://evil.com"];
    for (const v of garbage) {
      it(`"${v}" rejected at Zod level`, () => {
        expect(zodOk(v)).toBe(false);
      });
    }
  });
});

describe("parsePackageName", () => {
  describe("unscoped packages", () => {
    it("parses simple name", () => {
      expect(parsePackageName("react")).toEqual({
        name: "react",
        subpath: undefined,
      });
    });

    it("parses name with subpath", () => {
      expect(parsePackageName("lodash/get")).toEqual({
        name: "lodash",
        subpath: "./get",
      });
    });

    it("parses deep subpath", () => {
      expect(parsePackageName("lodash/fp/get")).toEqual({
        name: "lodash",
        subpath: "./fp/get",
      });
    });

    it("parses single character name", () => {
      expect(parsePackageName("x")).toEqual({
        name: "x",
        subpath: undefined,
      });
    });

    it("parses hyphenated name", () => {
      expect(parsePackageName("date-fns")).toEqual({
        name: "date-fns",
        subpath: undefined,
      });
    });

    it("parses dotted name", () => {
      expect(parsePackageName("chart.js")).toEqual({
        name: "chart.js",
        subpath: undefined,
      });
    });
  });

  describe("scoped packages", () => {
    it("parses scoped name", () => {
      expect(parsePackageName("@babel/core")).toEqual({
        name: "@babel/core",
        subpath: undefined,
      });
    });

    it("parses scoped name with subpath", () => {
      expect(parsePackageName("@mui/material/Button")).toEqual({
        name: "@mui/material",
        subpath: "./Button",
      });
    });

    it("parses scoped deep subpath", () => {
      expect(parsePackageName("@angular/core/testing/utils")).toEqual({
        name: "@angular/core",
        subpath: "./testing/utils",
      });
    });

    it("parses scope-only as name", () => {
      expect(parsePackageName("@scope")).toEqual({
        name: "@scope",
        subpath: undefined,
      });
    });
  });
});

describe("shouldSkipPackage — blacklist", () => {
  const blacklisted = [
    "@vitejs/plugin-react",
    "@vitejs/plugin-vue",
    "@rollup/plugin-node-resolve",
    "@rollup/plugin-commonjs",
    "react-scripts",
    "polymer-cli",
    "razzle",
    "babel-webpack-plugin",
    "css-rollup-plugin",
    "image-vite-plugin",
    "style-loader",
    "css-loader",
    "file-loader",
    "babel-loader",
    "ts-loader",
    "yarn",
    "npm",
    "pnpm",
    "bun",
    "devextreme",
  ];

  for (const pkg of blacklisted) {
    it(`blocks: ${pkg}`, () => {
      const result = shouldSkipPackage(pkg);
      expect(result.skip).toBe(true);
    });
  }
});

describe("shouldSkipPackage — hack/cheat spam", () => {
  const spam = [
    "game-hack-cheats",
    "roblox-hacks-cheats",
    "fortnite-hack-cheat",
    "coins-hack-unlimited",
    "vbucks-generator-unlimited",
    "coin-hack-12345",
    "gems-cheat-999",
    "my-hacks-tool",
    "free-hack-100",
  ];

  for (const pkg of spam) {
    it(`blocks spam: ${pkg}`, () => {
      expect(shouldSkipPackage(pkg).skip).toBe(true);
    });
  }
});

describe("shouldSkipPackage — blacklist false-positive prevention", () => {
  const shouldNotBlock = [
    "webpack-dev-server",
    "webpack-merge",
    "esbuild-wasm",
    "rollup-pluginutils",
    "vite-tsconfig-paths",
    "loader-utils",
    "loader-runner",
    "react-loader-spinner",
    "my-loader-utils",
    "nwjs",
    "bunyan",
    "yarn-deduplicate",
    "chai-as-promised",
    "jest-mock",
    "mocha-reporter",
    "hack",
    "cheat-code",
  ];

  for (const pkg of shouldNotBlock) {
    it(`allows: ${pkg}`, () => {
      expect(shouldSkipPackage(pkg).skip).toBe(false);
    });
  }
});

describe("shouldSkipPackage — unsupported", () => {
  describe("type packages", () => {
    const types = [
      "@types/react",
      "@types/node",
      "@types/lodash",
      "@types/express",
      "bun-types",
    ];
    for (const pkg of types) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Type");
      });
    }
  });

  describe("build tools", () => {
    const tools = [
      "webpack",
      "vite",
      "esbuild",
      "rollup",
      "parcel",
      "turbo",
      "lerna",
      "nx",
    ];
    for (const pkg of tools) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Build tools");
      });
    }

    it("allows build tool subpath", () => {
      expect(shouldSkipPackage("webpack", "./subpath").skip).toBe(false);
      expect(shouldSkipPackage("esbuild", "./wasm").skip).toBe(false);
      expect(shouldSkipPackage("vite", "./client").skip).toBe(false);
    });
  });

  describe("compilers", () => {
    const compilers = [
      "typescript",
      "ts-node",
      "babel-core",
      "@babel/core",
      "swc",
      "@swc/core",
    ];
    for (const pkg of compilers) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Compilers");
      });
    }
  });

  describe("testing frameworks", () => {
    const frameworks = [
      "jest",
      "vitest",
      "mocha",
      "chai",
      "cypress",
      "playwright",
      "puppeteer",
      "ava",
      "karma",
      "jasmine",
    ];
    for (const pkg of frameworks) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Testing");
      });
    }
  });

  describe("linters and formatters (no $ anchor — blocks prefixed packages too)", () => {
    const linters = [
      "eslint",
      "prettier",
      "stylelint",
      "jshint",
      "tslint",
      "@eslint/js",
      "@eslint/config-array",
      "@typescript-eslint/parser",
      "@typescript-eslint/eslint-plugin",
      "eslint-plugin-react",
      "eslint-config-next",
      "prettier-plugin-tailwindcss",
    ];
    for (const pkg of linters) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Linters");
      });
    }
  });

  describe("monolithic SDKs", () => {
    const sdks = [
      "aws-sdk",
      "googleapis",
      "azure-sdk",
      "@azure/storage-blob",
      "@azure/identity",
      "@google-cloud/storage",
      "@google-cloud/firestore",
    ];
    for (const pkg of sdks) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("SDK");
      });
    }
  });

  describe("native / heavy packages", () => {
    const heavy = [
      "jsdom",
      "canvas",
      "sharp",
      "phantomjs",
      "selenium-webdriver",
    ];
    for (const pkg of heavy) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("native");
      });
    }
  });

  describe("desktop frameworks", () => {
    const desktop = ["electron", "tauri", "nw.js"];
    for (const pkg of desktop) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Desktop");
      });
    }
  });

  describe("process managers", () => {
    const managers = ["pm2", "nodemon", "forever", "npm-run-all"];
    for (const pkg of managers) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("process managers");
      });
    }
  });

  describe("meta-frameworks", () => {
    const frameworks = [
      "next",
      "nuxt",
      "gatsby",
      "astro",
      "sapper",
      "blitz",
      "redwood",
    ];
    for (const pkg of frameworks) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
        expect(result.reason).toContain("Meta-frameworks");
      });
    }

    it("allows meta-framework subpath", () => {
      expect(shouldSkipPackage("next", "./image").skip).toBe(false);
      expect(shouldSkipPackage("next", "./link").skip).toBe(false);
      expect(shouldSkipPackage("astro", "./components").skip).toBe(false);
    });
  });

  describe("framework-specific scoped packages", () => {
    const scoped = [
      "@nuxt/kit",
      "@nuxt/schema",
      "@remix-run/node",
      "@remix-run/react",
      "@astrojs/react",
      "@astrojs/svelte",
      "@nestjs/core",
      "@nestjs/common",
    ];
    for (const pkg of scoped) {
      it(`blocks: ${pkg}`, () => {
        const result = shouldSkipPackage(pkg);
        expect(result.skip).toBe(true);
      });
    }

    it("allows framework scoped package subpath", () => {
      expect(shouldSkipPackage("@remix-run/react", "./subpath").skip).toBe(
        false
      );
      expect(shouldSkipPackage("@nuxt/kit", "./subpath").skip).toBe(false);
    });
  });
});

describe("shouldSkipPackage — allowed", () => {
  const allowed = [
    "react",
    "react-dom",
    "vue",
    "svelte",
    "solid-js",
    "preact",
    "lodash",
    "lodash-es",
    "axios",
    "zod",
    "date-fns",
    "dayjs",
    "moment",
    "rxjs",
    "ramda",
    "underscore",
    "d3",
    "three",
    "chart.js",
    "express",
    "fastify",
    "hono",
    "koa",
    "chalk",
    "commander",
    "yargs",
    "uuid",
    "nanoid",
    "marked",
    "highlight.js",
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-dynamodb",
    "framer-motion",
    "zustand",
    "jotai",
    "immer",
    "@tanstack/react-query",
    "@tanstack/react-table",
    "clsx",
    "classnames",
    "ms",
    "debug",
    "mitt",
    "eventemitter3",
  ];

  for (const pkg of allowed) {
    it(`allows: ${pkg}`, () => {
      expect(shouldSkipPackage(pkg).skip).toBe(false);
    });
  }
});

describe("parseInstallError patterns", () => {
  const VERSION_NOT_FOUND =
    /No version matching "(.+)" found for specifier "(.+)"/;
  const PACKAGE_NOT_FOUND = /GET .+ - 404/;

  function parseInstallError(stderr: string): string {
    const versionMatch = stderr.match(VERSION_NOT_FOUND);
    if (versionMatch) {
      return `No version of "${versionMatch[2]}" satisfies "${versionMatch[1]}"`;
    }
    if (PACKAGE_NOT_FOUND.test(stderr)) {
      const nameMatch = stderr.match(/error: (.+?) failed to resolve/);
      const pkg = nameMatch ? nameMatch[1] : "unknown";
      return `Package "${pkg}" not found on npm`;
    }
    return `Install failed: ${stderr.slice(0, 300)}`;
  }

  it("parses version-not-found from bun stderr", () => {
    const stderr = [
      'error: No version matching ">=999.0.0" found for specifier "react" (but package exists)',
      "error: react@>=999.0.0 failed to resolve",
    ].join("\n");
    expect(parseInstallError(stderr)).toBe(
      'No version of "react" satisfies ">=999.0.0"'
    );
  });

  it("parses version-not-found for scoped packages", () => {
    const stderr =
      'error: No version matching "^99.0.0" found for specifier "@babel/core" (but package exists)';
    expect(parseInstallError(stderr)).toBe(
      'No version of "@babel/core" satisfies "^99.0.0"'
    );
  });

  it("parses version-not-found for tilde range", () => {
    const stderr =
      'error: No version matching "~999.0.0" found for specifier "lodash" (but package exists)';
    expect(parseInstallError(stderr)).toBe(
      'No version of "lodash" satisfies "~999.0.0"'
    );
  });

  it("parses package-not-found 404", () => {
    const stderr = [
      "error: GET https://registry.npmjs.org/totallynonexistent - 404",
      "error: totallynonexistent@^1.0.0 failed to resolve",
    ].join("\n");
    expect(parseInstallError(stderr)).toBe(
      'Package "totallynonexistent@^1.0.0" not found on npm'
    );
  });

  it("parses 404 for scoped packages", () => {
    const stderr = [
      "error: GET https://registry.npmjs.org/@fake/pkg - 404",
      "error: @fake/pkg@latest failed to resolve",
    ].join("\n");
    expect(parseInstallError(stderr)).toBe(
      'Package "@fake/pkg@latest" not found on npm'
    );
  });

  it("returns 'unknown' when no failed-to-resolve line present", () => {
    const stderr = "error: GET https://registry.npmjs.org/something - 404";
    expect(parseInstallError(stderr)).toBe(
      'Package "unknown" not found on npm'
    );
  });

  it("falls back to raw stderr for unknown errors", () => {
    const stderr = "error: something unexpected happened";
    expect(parseInstallError(stderr)).toBe(
      "Install failed: error: something unexpected happened"
    );
  });

  it("truncates long stderr in fallback", () => {
    const stderr = "x".repeat(500);
    const result = parseInstallError(stderr);
    expect(result.length).toBeLessThanOrEqual(316);
  });
});
