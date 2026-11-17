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
    character: { id: "c", name: "小龍", appearance: look, personality: "溫柔", sharing: { allowAiQuotes: true } },
    wants: [],
    provider: null,
    unread: { notifications: 0, discoveries: 0 },
    pet: { stars: 0, stage: 0, nextAt: 3, accessories: [], canWalk: true, collected: 0, total: 4, letter: false, notify: true, pending: null },
  };
}

afterEach(() => {
  apiMock.mockReset();
  state.reload.mockReset();
  state.me = null;
});

describe("LW-10 settings save", () => {
  it("主按鈕叫「存起來」，改脾氣或分享不必用它，也不會把還沒存的名字一起送出", async () => {
    state.me = baby();
    apiMock.mockResolvedValue({});
    render(<MemoryRouter><MePage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "存起來" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "儲存名字" })).toBeNull();

    await userEvent.clear(screen.getByLabelText("寶寶名字"));
    await userEvent.type(screen.getByLabelText("寶寶名字"), "還沒存的名字");

    const advanced = document.querySelector("details.advanced") as HTMLDetailsElement;
    advanced.open = true;

    await userEvent.clear(screen.getByLabelText("脾氣"));
    await userEvent.type(screen.getByLabelText("脾氣"), "喜歡曬太陽");
    await userEvent.click(screen.getByRole("button", { name: "把脾氣存起來" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    expect(apiMock).toHaveBeenCalledWith("/api/me/character", {
      method: "PUT",
      body: {
        name: "小龍",
        appearance: look,
        personality: "喜歡曬太陽",
        sharing: { allowAiQuotes: true },
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("存好了。");

    await userEvent.click(screen.getByLabelText("做過的事可以說給鎮上的朋友聽"));
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock).toHaveBeenLastCalledWith("/api/me/character", {
      method: "PUT",
      body: {
        name: "小龍",
        appearance: look,
        personality: "溫柔",
        sharing: { allowAiQuotes: false },
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("存好了。");
  });

  it("分享開關失敗時會把勾選還原", async () => {
    state.me = baby();
    apiMock.mockRejectedValueOnce(new Error("連不上"));
    render(<MemoryRouter><MePage /></MemoryRouter>);
    (document.querySelector("details.advanced") as HTMLDetailsElement).open = true;
    const box = screen.getByLabelText("做過的事可以說給鎮上的朋友聽");
    expect(box).toBeChecked();
    await userEvent.click(box);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("連不上"));
    expect(box).toBeChecked();
  });
});
