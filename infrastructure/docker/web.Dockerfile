FROM oven/bun:1.3.6-slim AS base

FROM base AS pruner
WORKDIR /app

RUN bun add -g turbo

COPY . .

RUN turbo prune web --docker

FROM base AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .

COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install

COPY --from=pruner /app/out/full/ .

FROM installer AS builder
WORKDIR /app

ARG VITE_SERVER_URL

ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN bun run turbo build --filter=web

FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends adduser && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vite && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=vite:nodejs /app/apps/web/dist ./dist

USER vite

EXPOSE 4002

ENV NODE_ENV=production
ENV PORT=4002
ENV HOSTNAME="0.0.0.0"

CMD ["bunx", "serve", "./dist", "-s", "-l", "4002"]
