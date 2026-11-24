import { bannedHits } from "@lj/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, FRIENDLY_BY_CODE, FRIENDLY_FALLBACK, NAME_MODERATION_HINT } from "./api";

afterEach(() => vi.unstubAllGlobals());

function stubError(code: string, raw: string, status = 422) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code, message: raw } }), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

describe("api", () => {
  it("sends JSON with credentials and returns the body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/api/x", { method: "POST", body: { a: 1 } })).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"a":1}' }),
    );
  });

  it("returns null for 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    expect(await api("/api/x", { method: "POST" })).toBeNull();
  });

  it("prefers the friendly mapped message over a raw Chinese server error", async () => {
    stubError("moderation_blocked", "內容不符合社群規範");
    const err = await api("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 422,
      code: "moderation_blocked",
      message: FRIENDLY_BY_CODE.moderation_blocked,
    });
  });

  it("uses the friendly fallback when the code is unknown and the raw message is English", async () => {
    stubError("internal", "boom", 500);
    const err = await api("/api/x").catch((e) => e);
    expect(err).toMatchObject({ status: 500, code: "internal", message: FRIENDLY_FALLBACK });
  });
});

describe("friendly error copy", () => {
  const nextStep = /再|換|先|看看|登入|歇/;
  const messages = [...Object.values(FRIENDLY_BY_CODE), FRIENDLY_FALLBACK, NAME_MODERATION_HINT];

  it("keeps every mapped message free of novice jargon", () => {
    for (const message of messages) {
      expect(bannedHits(message), message).toEqual([]);
    }
  });

  it("gives each mapped message a next step", () => {
    for (const message of messages) {
      expect(message, message).toMatch(nextStep);
    }
  });
});
