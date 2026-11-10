# syntax=docker/dockerfile:1

# Production image: one Node process serves the API, MCP, OAuth and the built web app.
# Migrations run on startup (see apps/server/src/index.ts) using MIGRATIONS_DIR.

# ---- build ----
FROM node:22-slim AS build
ENV CI=true \
    npm_config_update_notifier=false
RUN npm install -g pnpm@10.28.0
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
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
