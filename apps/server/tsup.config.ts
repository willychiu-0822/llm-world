import { defineConfig } from "tsup";

// One self-contained ESM bundle per entry: the runtime image needs only Node, the bundle,
// the SQL migrations and the built web app.
export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts", "src/seed-demo.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  noExternal: [/.*/],
  external: ["pg-native"],
  splitting: true,
  sourcemap: true,
  banner: { js: "import { createRequire as __lj_cr } from 'node:module'; const require = __lj_cr(import.meta.url);" },
});
