import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./Login";

const state = vi.hoisted(() => ({
  config: { appName: "龍角鎮", devLogin: true, googleLogin: false, mcpUrl: "http://127.0.0.1/mcp" } as {
    appName: string; devLogin: boolean; googleLogin: boolean; mcpUrl: string;
  } | null,
  configError: false,
}));

vi.mock("../lib/session", () => ({
  useSession: () => ({
    me: null,
    loading: false,
    config: state.config,
    configError: state.configError,
    reloadConfig: vi.fn(),
    reload: vi.fn(),
    toast: vi.fn(),
  }),
}));

function renderLogin(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage — LW-20 closed door", () => {
  it("explains the town is still preparing and offers a way home when no sign-in is available", () => {
    state.config = { appName: "龍角鎮", devLogin: false, googleLogin: false, mcpUrl: "http://127.0.0.1/mcp" };
    renderLogin();
    expect(screen.getByRole("status")).toHaveTextContent("小鎮還在整理門口，晚點再來。");
    expect(screen.getByRole("link", { name: "回首頁" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "使用 Google 帳號登入" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "開發用登入" })).not.toBeInTheDocument();
  });

  it("does not mention the development login when Google is unavailable", () => {
    state.config = { appName: "龍角鎮", devLogin: true, googleLogin: false, mcpUrl: "http://127.0.0.1/mcp" };
    renderLogin("?error=google_unavailable");
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/Google 登入尚未開放/);
    expect(notice).not.toHaveTextContent("開發用登入");
    expect(screen.getByRole("button", { name: "開發用登入" })).toBeInTheDocument();
  });

  it("keeps the closed-door notice when Google is also flagged unavailable", () => {
    state.config = { appName: "龍角鎮", devLogin: false, googleLogin: false, mcpUrl: "http://127.0.0.1/mcp" };
    renderLogin("?error=google_unavailable");
    expect(screen.getByRole("status")).toHaveTextContent("小鎮還在整理門口，晚點再來。");
    expect(screen.getByRole("link", { name: "回首頁" })).toBeInTheDocument();
    expect(screen.queryByText(/開發用登入/)).not.toBeInTheDocument();
  });
});
