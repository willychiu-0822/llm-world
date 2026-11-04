import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("sends JSON with credentials and returns the body", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/api/x", { method: "POST", body: { a: 1 } })).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/x", expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"a":1}' }));
  });

  it("returns null for 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect(await api("/api/x", { method: "POST" })).toBeNull();
  });

  it("throws ApiError with the server's code and a friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "moderation_blocked", message: "內容不符合社群規範" } }), { status: 422, headers: { "content-type": "application/json" } })));
    const err = await api("/api/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "moderation_blocked", message: "內容不符合社群規範" });
  });
});
