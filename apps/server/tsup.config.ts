import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/seed-demo.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  noExternal: ["@lj/core", "@lj/db"],
  sourcemap: true,
});
