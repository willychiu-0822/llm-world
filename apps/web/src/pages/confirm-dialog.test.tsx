import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APPEARANCE } from "@lj/core";
import { AdminPage } from "./Admin";
import { ConnectPage } from "./Connect";
import { MePage } from "./Me";
import type { Me } from "../lib/types";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {},
}));

const state = vi.hoisted(() => ({
  me: null as Me | null,
  connections: [] as Array<{ clientId: string; name: string; connectedAt: string; lastUsedAt: string | null }>,
}));

vi.mock("../lib/session", () => ({
  useSession: () => ({
    me: state.me,
    loading: false,
    config: { appName: "龍角鎮", devLogin: true, googleLogin: false, mcpUrl: "http://127.0.0.1/mcp" },
    configError: false,
    reloadConfig: vi.fn(),
    reload: vi.fn(),
    toast: vi.fn(),
  }),
}));

vi.mock("../lib/useFetch", () => ({
  useFetch: (path: string | null) => {
    if (path?.includes("/api/me/connections")) {
      return { data: state.connections, error: null, loading: false, reload: vi.fn(), setData: vi.fn() };
    }
    if (path?.includes("/api/admin")) {
      return { data: path.includes("metrics") ? { users: 0, characters: 0, steps: { total: 0, draft: 0, confirmed: 0, done: 0, dropped: 0, byExecutor: { ai: 0, self: 0 } }, deeds: { total: 0, real: 0, demo: 0, followed: 0 }, notes: { before: 0, after: 0, shared: 0 } } : [], error: null, loading: false, reload: vi.fn(), setData: vi.fn() };
    }
    return { data: null, error: null, loading: false, reload: vi.fn(), setData: vi.fn() };
  },
}));

const look = { ...DEFAULT_APPEARANCE, description: "" };

function owner(stage = 2, admin = false): Me {
  return {
    user: { id: "u", email: "baby@example.com", displayName: "安", roles: admin ? ["user", "admin"] : ["user"] },
    character: { id: "c", name: "小龍", appearance: look, personality: "", sharing: { allowAiQuotes: true } },
    wants: [],
    provider: null,
    unread: { notifications: 0, discoveries: 0 },
    pet: { stars: 0, stage, nextAt: 3, accessories: [], canWalk: true, collected: 0, total: 4, letter: false, notify: true, pending: null },
  };
}

async function openDeleteDialog() {
  state.me = owner(0);
  render(<MemoryRouter><MePage /></MemoryRouter>);
  (document.querySelector("details.advanced") as HTMLDetailsElement).open = true;
  await userEvent.click(screen.getByRole("button", { name: "刪除帳號" }));
  return screen.findByRole("dialog", { name: "刪除帳號" });
}

afterEach(() => {
  apiMock.mockReset();
  state.me = null;
  state.connections = [];
});

describe("LW-09 confirm dialogs", () => {
  beforeEach(() => {
    apiMock.mockResolvedValue(undefined);
  });

  it("刪除帳號用對話框，預設焦點在「先留著」，Esc 會取消、不會真的刪", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const dialog = await openDeleteDialog();
    const keep = screen.getByRole("button", { name: "先留著" });
    expect(screen.getByRole("button", { name: "刪掉小龍和所有紀錄" })).toBeInTheDocument();
    await waitFor(() => expect(keep).toHaveFocus());
    expect(keep).toHaveClass("btn", "primary");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(apiMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("中斷連接與清除示範內容也改用對話框，按先留著不會送出", async () => {
    state.me = owner(2, true);
    state.connections = [{ clientId: "c1", name: "小助手", connectedAt: "2026-11-14T00:00:00.000Z", lastUsedAt: null }];

    const { unmount } = render(<MemoryRouter><ConnectPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "中斷連接" }));
    const disconnect = await screen.findByRole("dialog", { name: "中斷連接" });
    expect(screen.getByRole("heading", { name: "要中斷「小助手」嗎？" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "先留著" }));
    await waitFor(() => expect(disconnect).not.toBeInTheDocument());
    expect(apiMock).not.toHaveBeenCalled();
    unmount();

    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "清除所有示範內容" }));
    const purge = await screen.findByRole("dialog", { name: "清除示範內容" });
    expect(screen.getByRole("heading", { name: "要清除所有示範內容嗎？" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "先留著" }));
    await waitFor(() => expect(purge).not.toBeInTheDocument());
    expect(apiMock).not.toHaveBeenCalled();
  });
});
