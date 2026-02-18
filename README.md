# SizePanic

SizePanic is a fast npm package size analyzer.

It helps you understand the real bundle cost of dependencies before shipping by analyzing raw size, gzip size, and estimated download time.

## What It Does

- Analyze a single package (`name`, `name@version`, scoped packages, and subpaths)
- Analyze many dependencies from a `package.json` upload
- Generate badges for package size widgets
- Show raw bytes, gzip bytes, and network-time estimates
- Surface package metadata (license, links, dependency counts)
- Track product analytics events on the web app (Databuddy)

## Monorepo Layout

This repository uses Bun workspaces + Turborepo.

```
apps/
  web/      # React + Vite frontend
  server/   # Elysia API server and analysis runtime
packages/
  api/      # tRPC routers and input schemas
  env/      # Shared environment validation (zod)
```

## Tech Stack

- Runtime: Bun
- Frontend: React, Vite, TanStack Router, TanStack Query
- Backend: Elysia, tRPC, zod
- Monorepo: Turborepo
- Deployment: Docker / Docker Compose

## Prerequisites

- Bun `>=1.3`

## Local Development

Install dependencies:

```bash
bun install
```

Run all apps in dev mode:

```bash
bun dev
```

Run quality checks:

```bash
bun check-types
bun check
```

Build all workspaces:

```bash
bun run build
```

## Environment Variables

Set the following values before running locally or in production.

### Server (`apps/server`)

- `WEB_URL` - Allowed web origin for CORS (example: `https://sizepanic.com`)

### Web (`apps/web`)

- `VITE_SERVER_URL` - Public server base URL used by the frontend (example: `https://api.sizepanic.com`)

## Docker

Build containers:

```bash
bun run docker:build
```

Run stack:

```bash
bun run docker:up
```

Current compose setup includes:

- Server CPU/memory limits
- `/tmp` mounted as `tmpfs` with size cap to reduce disk-abuse risk
- Container healthchecks for both web and server

## Badge Guide

Shields.io badge examples:

![react gzip size](https://img.shields.io/endpoint?url=https://api.sizepanic.com/badge/react%3Ftype%3Dgzip)
![zod 4.1.13 brotli size](https://img.shields.io/endpoint?url=https://api.sizepanic.com/badge/zod%3Fversion%3D4.1.13%26type%3Dbrotli)

Generate your badge now: https://sizepanic.com/badge

## Security Notes

- Input validation is enforced via zod in the API layer.
- Server-side analysis uses bounded concurrency and queue timeouts.
- Batch analysis has upper limits to reduce abuse impact.

## License

Licensed under MIT. See `LICENSE` for details.
