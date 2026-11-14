import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Server and db tests share one Postgres test database, so files run one at a time.
    fileParallelism: false,
    projects: [
      "packages/core",
      "packages/db",
      "apps/server",
      "apps/web/vite.config.ts",
      {
        test: {
          name: "e2e-guard",
          environment: "node",
          include: ["e2e/assert-e2e-database.test.mjs"],
        },
      },
    ],
  },
});
