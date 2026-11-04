import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "server",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_test",
    },
  },
});
