import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "./client";

describe("normalizeDatabaseUrl", () => {
  it("leaves local and strict URLs alone", () => {
    const local = "postgres://postgres:postgres@localhost:5432/longjiao_dev";
    expect(normalizeDatabaseUrl(local)).toBe(local);
    const strict = "postgres://u:p@ep.neon.tech/db?sslmode=verify-full";
    expect(normalizeDatabaseUrl(strict)).toBe(strict);
    const compat = "postgres://u:p@ep.neon.tech/db?uselibpqcompat=true&sslmode=require";
    expect(normalizeDatabaseUrl(compat)).toBe(compat);
  });

  it("relaxes libpq-style require so hosted Postgres URLs connect", () => {
    expect(normalizeDatabaseUrl("postgres://u:p@ep.neon.tech/db?sslmode=require")).toBe(
      "postgres://u:p@ep.neon.tech/db?sslmode=no-verify",
    );
    expect(normalizeDatabaseUrl("postgresql://u:p@dpg.example/db?sslmode=require&channel_binding=require")).toBe(
      "postgresql://u:p@dpg.example/db?sslmode=no-verify&channel_binding=require",
    );
  });
});
