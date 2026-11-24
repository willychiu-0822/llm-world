import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFetch } from "./useFetch";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("./api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

function Probe({ path }: { path: string | null }) {
  const { data, error, loading, reload } = useFetch<{ id: string }>(path);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="data">{data ? data.id : "none"}</span>
      <span data-testid="error">{error ? error.message : "none"}</span>
      <button type="button" onClick={() => void reload()}>
        再抓一次
      </button>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  apiMock.mockReset();
});

describe("useFetch", () => {
  it("路徑換成新的之後，先發出、後到的舊回應不會蓋掉新資料，載入中也會一直等到新的回來", async () => {
    const first = deferred<{ id: string }>();
    const second = deferred<{ id: string }>();
    apiMock.mockImplementation((path: string) => {
      if (path === "/old") return first.promise;
      if (path === "/new") return second.promise;
      throw new Error(`unexpected ${path}`);
    });

    const { rerender } = render(<Probe path="/old" />);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    rerender(<Probe path="/new" />);
    expect(screen.getByTestId("data")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      first.resolve({ id: "old" });
      await Promise.resolve();
    });
    expect(screen.getByTestId("data")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("error")).toHaveTextContent("none");

    await act(async () => {
      second.resolve({ id: "new" });
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("new"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("連點再抓一次時，較早那次的回應不會蓋掉較晚開始的結果", async () => {
    const calls = [deferred<{ id: string }>(), deferred<{ id: string }>()];
    let i = 0;
    apiMock.mockImplementation(() => calls[i++]!.promise);

    render(<Probe path="/item" />);
    await act(async () => {
      calls[0]!.resolve({ id: "first" });
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("first"));

    const later = deferred<{ id: string }>();
    const earlierRetry = deferred<{ id: string }>();
    apiMock.mockImplementationOnce(() => earlierRetry.promise);
    apiMock.mockImplementationOnce(() => later.promise);

    await act(async () => {
      screen.getByRole("button", { name: "再抓一次" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "再抓一次" }).click();
    });

    await act(async () => {
      earlierRetry.resolve({ id: "stale" });
      await Promise.resolve();
    });
    expect(screen.getByTestId("data")).toHaveTextContent("first");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      later.resolve({ id: "fresh" });
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("fresh"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("元件卸載後，晚到的回應不會再寫入狀態", async () => {
    const pending = deferred<{ id: string }>();
    apiMock.mockImplementation(() => pending.promise);

    const { unmount } = render(<Probe path="/item" />);
    unmount();

    await act(async () => {
      pending.resolve({ id: "late" });
      await Promise.resolve();
    });
    expect(screen.queryByTestId("data")).toBeNull();
  });

  it("沒有路徑時不發請求，也不處於載入中", () => {
    render(<Probe path={null} />);
    expect(apiMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("data")).toHaveTextContent("none");
  });

  it("較早請求失敗、較晚請求成功時，不會留下舊錯誤", async () => {
    const first = deferred<{ id: string }>();
    const second = deferred<{ id: string }>();
    apiMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { rerender } = render(<Probe path="/a" />);
    rerender(<Probe path="/b" />);

    await act(async () => {
      first.reject(new Error("舊路徑失敗"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      second.resolve({ id: "b" });
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("b"));
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});
