import { describe, expect, it } from "vitest";
import { assertE2eDatabase } from "./assert-e2e-database.mjs";

describe("assertE2eDatabase", () => {
  it("allows the CI database and the local session database", () => {
    expect(() => assertE2eDatabase("postgres://postgres:postgres@localhost:5432/longjiao_e2e")).not.toThrow();
    expect(() => assertE2eDatabase("postgres://postgres:postgres@127.0.0.1:5433/longjiao_laned_e2e")).not.toThrow();
  });

  it("refuses development, unit-test, and missing databases", () => {
    expect(() => assertE2eDatabase("postgres://postgres:postgres@localhost:5432/longjiao_dev")).toThrow(/_e2e/);
    expect(() => assertE2eDatabase("postgres://postgres:postgres@localhost:5432/longjiao_test")).toThrow(/_e2e/);
    expect(() => assertE2eDatabase(undefined)).toThrow(/_e2e/);
    expect(() => assertE2eDatabase("")).toThrow(/_e2e/);
  });
});
