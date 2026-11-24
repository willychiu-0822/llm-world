import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFetch } from "./useFetch";

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock("./api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

function Probe({ path }: { path: string | null }) {
  const { data, error, loading } = useFetch<{ id: string }>(path);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="data">{data ? data.id : "none"}</span>
      <span data-testid="error">{error ? error.message : "none"}</span>
    </div>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  apiMock.mockReset();
});

describe("useFetch", () => {
  it("換路徑後，先發出的舊回應不能關掉載入中，也不能蓋掉新資料", async () => {
    const first = deferred<{ id: string }>();
    const second = deferred<{ id: string }>();
    apiMock.mockImplementation((path: string) => (path === "/old" ? first.promise : second.promise));

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

    await act(async () => {
      second.resolve({ id: "new" });
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("new"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("路徑拿掉時，還沒回來的舊請求不能讓畫面停在載入中", async () => {
    const pending = deferred<{ id: string }>();
    apiMock.mockImplementation(() => pending.promise);
    const { rerender } = render(<Probe path="/slow" />);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    rerender(<Probe path={null} />);
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("data")).toHaveTextContent("none");

    await act(async () => {
      pending.resolve({ id: "late" });
      await Promise.resolve();
    });
    expect(screen.getByTestId("data")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("頁面從往返快取回來時，原先沒結束的讀取不會一直停在載入中", async () => {
    let calls = 0;
    const first = deferred<{ id: string }>();
    apiMock.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? first.promise : Promise.resolve({ id: "restored" });
    });
    render(<Probe path="/item" />);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("restored"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});
