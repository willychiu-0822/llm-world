import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./session";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("./api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

function Gate() {
  const { loading, me } = useSession();
  if (loading) return <p>載入中……</p>;
  return <p>{me ? "已進來" : "未登入"}</p>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const me = {
  user: { id: "u1", email: "a@e2e.test", displayName: "小圓", roles: [] },
  character: { id: "c1", name: "小圓", appearance: {}, personality: "", sharing: { allowAiQuotes: false } },
  wants: [],
  provider: null,
  unread: { notifications: 0, discoveries: 0 },
  pet: null,
};

afterEach(() => apiMock.mockReset());

describe("session restore", () => {
  it("重新顯示仍停在載入中的頁面時，會再讀一次登入狀態", async () => {
    const first = deferred<{ me: typeof me }>();
    let sessions = 0;
    apiMock.mockImplementation((path: string) => {
      if (path === "/api/config") return Promise.resolve({ appName: "龍角鎮", devLogin: true, googleLogin: false, mcpUrl: "http://localhost/mcp" });
      sessions += 1;
      return sessions === 1 ? first.promise : Promise.resolve({ me });
    });

    render(<SessionProvider><Gate /></SessionProvider>);
    expect(screen.getByText("載入中……")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await waitFor(() => expect(screen.getByText("已進來")).toBeInTheDocument());
    expect(screen.queryByText("載入中……")).not.toBeInTheDocument();
  });
});
