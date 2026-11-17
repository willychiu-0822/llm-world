import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GrownGate } from "./GrownGate";

const state = vi.hoisted(() => ({ stage: 0 }));

vi.mock("../lib/session", () => ({
  useSession: () => ({
    me: { pet: { stage: state.stage } },
    loading: false,
  }),
}));

describe("GrownGate", () => {
  it("還沒長大時不提階段名稱，並說明這裡之後會開門", () => {
    state.stage = 0;
    render(<MemoryRouter><GrownGate><p>裡面的內容</p></GrownGate></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "小龍還沒長大" })).toBeInTheDocument();
    expect(screen.getByText("等小龍再長大一點，這裡就會開門。先回家陪牠。")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/圍巾尺寸/);
    expect(screen.queryByText("裡面的內容")).toBeNull();
    expect(screen.getByRole("link", { name: "回家陪小龍" })).toHaveAttribute("href", "/");
  });

  it("長大後直接顯示裡面的內容", () => {
    state.stage = 2;
    render(<MemoryRouter><GrownGate><p>裡面的內容</p></GrownGate></MemoryRouter>);
    expect(screen.getByText("裡面的內容")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "小龍還沒長大" })).toBeNull();
  });
});
