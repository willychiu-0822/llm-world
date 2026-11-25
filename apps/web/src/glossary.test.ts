import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** User-facing copy that must stay on the glossary terms in docs/GLOSSARY.md. */
const ROOTS = [
  "apps/web/src",
  "apps/server/src/oauth/routes.ts",
  "apps/server/src/services/connections.ts",
  "apps/server/src/services/providers.ts",
  "apps/server/src/mcp/server.ts",
  "apps/server/src/seed/demo.ts",
];

const FORBIDDEN: Array<[string, RegExp]> = [
  ["寶寶", /寶寶/],
  ["幫手", /(?<!小)幫手/],
  ["角色", /角色/],
  ["用戶端", /用戶端/],
  ["你的 AI", /你的 AI/],
  ["AI 角色", /AI 角色/],
  ["AI 執行", /AI 執行/],
  ["AI 建議", /AI 建議/],
  ["AI 帶回", /AI 帶回/],
  ["交給 AI", /交給 AI/],
  ["大家的 AI", /大家的 AI/],
  ["有人的 AI", /有人的 AI/],
  ["建議的 AI", /建議的 AI/],
  ["AI 工具", /AI 工具/],
  ["跟 AI", /跟 AI/],
  ["請 AI", /請 AI/],
];

function filesUnder(full: string): string[] {
  if (!statSync(full).isDirectory()) return [full];
  const out: string[] = [];
  for (const name of readdirSync(full)) {
    const child = join(full, name);
    if (statSync(child).isDirectory()) out.push(...filesUnder(child));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(child);
  }
  return out;
}

describe("glossary", () => {
  it("keeps retired names out of user-facing copy", () => {
    const hits: string[] = [];
    for (const file of ROOTS.flatMap((path) => filesUnder(join(root, path)))) {
      const text = readFileSync(file, "utf8");
      for (const [name, re] of FORBIDDEN) {
        if (re.test(text)) hits.push(`${file} still says ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
