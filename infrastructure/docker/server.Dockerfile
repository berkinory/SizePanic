FROM oven/bun:1.3.6-slim AS base

FROM base AS pruner
WORKDIR /app

RUN bun add -g turbo

COPY . .

RUN turbo prune server --docker

FROM base AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .

COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install

COPY --from=pruner /app/out/full/ .

FROM installer AS builder
WORKDIR /app

RUN cd apps/server && bun run build

FROM busybox:musl AS busybox

FROM gcr.io/distroless/base-debian12:nonroot AS runner
WORKDIR /app

COPY --from=busybox /bin/wget /bin/wget

COPY --from=builder --chown=nonroot:nonroot /app/apps/server/server /app/server

USER nonroot

EXPOSE 4000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["/app/server"]
