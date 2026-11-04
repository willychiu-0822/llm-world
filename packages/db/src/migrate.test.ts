import { DISTRICTS } from "@lj/core";
import { describe, expect, it } from "vitest";
import { connect } from "./client";
import { migrateWithLock } from "./migrate";
import { places } from "./schema";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/longjiao_test";

describe("migrateWithLock", () => {
  it("can run concurrently without errors", async () => {
    await Promise.all([migrateWithLock(url), migrateWithLock(url), migrateWithLock(url)]);
    const h = connect(url, { max: 1 });
    const rows = await h.db.select().from(places);
    expect(rows.filter((p) => p.kind === "public").length).toBe(DISTRICTS.length);
    await h.close();
  });
});
