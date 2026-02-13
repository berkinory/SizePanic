# Monorepo

Turborepo monorepo with Bun as the package manager.
Some information may not be the same as the actual structure.

## Structure

```
apps/
  dashboard  → Vite + React (TanStack Router)
  docs       → Next.js (Fumadocs)
  extension  → WXT browser extension
  mobile     → Expo (React Native)
  server     → ElysiaJS + tRPC
  www        → Astro
packages/
  api        → tRPC router definitions
  config     → Shared tsconfig bases
  env        → Shared environment variables (Zod validated)
```

## Package Manager

Always use `bun`. Never use npm, yarn, or pnpm.

## Quality Gates

Do not write unnecessary comment lines and never use emojis. 

Both must pass with zero errors before any work is considered done:

- `bun check` — Lint and format (ultracite + oxfmt + oxlint)
- `bun check-types` — Type checking across all packages (tsgo via turbo)

## Shared Packages

- Apps extend `@reponame/config/tsconfig.base.json` (or `tsconfig.astro.json` for Astro).
- `@reponame/env` provides validated env vars to server, dashboard, and www.
- Dependencies shared across web apps use `"catalog:"` in package.json. Mobile pins its own versions (Expo SDK dictates React/RN versions).

## Turbo

Run any task for a specific app: `turbo -F <app> <task>` (e.g. `turbo -F www dev`).

## Skills

Use the relevant skill when working on a specific domain:

- **astro** — Astro patterns and config
- **turborepo** — Turbo pipelines, caching, monorepo structure
- **elysiajs** — ElysiaJS backend development
- **vercel-react-native-skills** — React Native / Expo best practices
- **frontend-design** — Production-grade UI components and pages
- **interaction-design** — Microinteractions, motion, transitions
- **seo-audit** — Technical SEO auditing
- **programmatic-seo** — SEO-driven pages at scale
- **content-strategy** — Content planning and topic clusters
- **remotion-best-practices** — Video creation with Remotion
