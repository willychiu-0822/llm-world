import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APPEARANCE } from "@lj/core";
import { MePage } from "./Me";
import type { Me } from "../lib/types";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

const state = vi.hoisted(() => ({ me: null as Me | null, reload: vi.fn() }));
vi.mock("../lib/session", () => ({
  useSession: () => ({
    me: state.me,
    loading: false,
    reload: state.reload,
    toast: vi.fn(),
  }),
}));

const look = { ...DEFAULT_APPEARANCE, description: "" };

function baby(): Me {
  return {
    user: { id: "u", email: "baby@example.com", displayName: "安", roles: ["user"] },
    character: {
      id: "c",
      name: "小龍",
      appearance: look,
      personality: "溫柔",
      sharing: { allowAiQuotes: true },
    },
    wants: [],
    provider: null,
    unread: { notifications: 0, discoveries: 0 },
    pet: {
      stars: 0,
      stage: 0,
      nextAt: 3,
      accessories: [],
      canWalk: true,
      collected: 0,
      total: 4,
      letter: false,
      notify: true,
      pending: null,
    },
  };
}

afterEach(() => {
  apiMock.mockReset();
  state.reload.mockReset();
  state.me = null;
  vi.unstubAllGlobals();
});

describe("LW-11 settings action errors", () => {
  it("登出失敗時留下提示，可以再按一次", async () => {
    state.me = baby();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    apiMock.mockRejectedValueOnce(new Error("network"));
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "登出" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "剛剛沒有登出成功。再按一次登出就好。",
    );
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "登出" })).toBeEnabled();

    apiMock.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole("button", { name: "登出" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  });

  it("刪除帳號失敗時對話框留下提示，可以再試", async () => {
    state.me = baby();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    apiMock.mockRejectedValueOnce(new Error("network"));
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    (document.querySelector("details.advanced") as HTMLDetailsElement).open = true;
    await userEvent.click(screen.getByRole("button", { name: "刪除帳號" }));
    await userEvent.click(screen.getByRole("button", { name: "刪掉小龍和所有紀錄" }));
    const dialog = await screen.findByRole("dialog", { name: "刪除帳號" });
    expect(dialog).toHaveTextContent("帳號還沒刪掉。再按一次試試看。");
    expect(assign).not.toHaveBeenCalled();

    apiMock.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole("button", { name: "刪掉小龍和所有紀錄" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  });

  it("提醒開關失敗時把勾選還原，並提示再按一次", async () => {
    state.me = baby();
    apiMock.mockRejectedValueOnce(new Error("network"));
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    const box = screen.getByLabelText("新消息提醒");
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(await screen.findByRole("alert")).toHaveTextContent("提醒沒有改成。再按一次就好。");
    expect(box).toBeChecked();
  });
});
