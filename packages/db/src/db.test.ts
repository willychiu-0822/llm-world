import { DISTRICTS } from "@lj/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, type DbHandle } from "./client";
import { newId, sha256 } from "./ids";
import { resetDatabase } from "./base";
import { runMigrations } from "./migrate";
import { places, users } from "./schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_test";
let h: DbHandle;

beforeAll(async () => {
  h = connect(url, { max: 2 });
  await runMigrations(h.db);
});
afterAll(async () => h.close());

describe("database", () => {
  it("applies migrations idempotently and creates one public place per district", async () => {
    await runMigrations(h.db);
    await resetDatabase(h.db);
    const rows = await h.db.select().from(places);
    expect(rows.filter((p) => p.kind === "public")).toHaveLength(DISTRICTS.length);
  });

  it("resetDatabase removes data", async () => {
    await h.db.insert(users).values({ id: newId("usr"), email: "a@example.com" });
    await resetDatabase(h.db);
    expect(await h.db.select().from(users)).toHaveLength(0);
  });
});

describe("ids", () => {
  it("creates prefixed unique ids", () => {
    const a = newId("deed");
    expect(a).toMatch(/^deed_[0-9a-z]{16}$/);
    expect(new Set(Array.from({ length: 200 }, () => newId("x"))).size).toBe(200);
  });
  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).toHaveLength(64);
  });
});
