# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @lj/web build && pnpm --filter @lj/server build

# ---- runtime: Node + self-contained bundles, no node_modules ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    MIGRATIONS_DIR=/app/migrations \
    WEB_DIST=/app/web
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/packages/db/migrations ./migrations
COPY --from=build /app/apps/web/dist ./web
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.js"]
