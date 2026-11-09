import { readdir, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../apps/web/dist/assets/", import.meta.url);
const chunks = await Promise.all((await readdir(dir)).filter(n => n.endsWith(".js")).map(async name => ({ name, bytes: (await stat(new URL(name, dir))).size })));
assert(chunks.length > 0, "Build the web app before checking chunks");
for (const c of chunks.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`${c.name}: ${c.bytes} bytes`);
  assert(c.bytes < 400_000, `P2-6: ${c.name} must be smaller than 400 kB`);
}
