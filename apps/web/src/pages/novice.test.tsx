import { DEFAULT_APPEARANCE, bannedHits } from "@lj/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "../components/Layout";
import { AdoptWizard } from "../components/AdoptWizard";
import { CabinetView } from "../components/CabinetView";
import { Celebrate } from "../components/Celebrate";
import { HomePage } from "./Home";
import { MePage } from "./Me";
import type { Me } from "../lib/types";

const look = { ...DEFAULT_APPEARANCE, description: "" };

const state = vi.hoisted(() => ({ me: null as Me | null }));

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
    if (!path) return { data: null, error: null, loading: false, reload: vi.fn() };
    if (path.includes("town")) return { data: { districts: [], places: [] }, error: null, loading: false, reload: vi.fn() };
    if (path.includes("first-steps")) return { data: [], error: null, loading: false, reload: vi.fn() };
    return { data: null, error: null, loading: false, reload: vi.fn() };
  },
}));

const baby = (): Me => ({
  user: { id: "u", email: "baby@example.com", displayName: "安", roles: ["user"] },
  character: { id: "c", name: "小龍", appearance: look, personality: "", sharing: { allowAiQuotes: true } },
  wants: [],
  provider: null,
  unread: { notifications: 0, discoveries: 0 },
  pet: { stars: 0, stage: 0, nextAt: 3, accessories: [], canWalk: true, collected: 0, total: 4, letter: false, notify: true, pending: null },
});

describe("novice loop", () => {
  beforeEach(() => { state.me = null; });

  it("gives a guest one way in, with no jargon", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "把牠撿回家" })).toHaveClass("btn primary");
    expect(screen.queryByRole("link", { name: "先隨便看看" })).not.toBeInTheDocument();
    expect(screen.queryByText(/滾輪/)).not.toBeInTheDocument();
    expect(bannedHits(document.body.textContent ?? "")).toEqual([]);
  });

  it("shows the baby and a single main action", async () => {
    state.me = baby();
    render(<MemoryRouter><Layout><HomePage /></Layout></MemoryRouter>);
    expect(screen.getAllByRole("link", { name: "家" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "地圖" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "收藏櫃" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "鏡子" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "連接 AI" })).not.toBeInTheDocument();
    const primary = document.querySelectorAll(".btn.primary");
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("出門逛逛");
    await userEvent.click(screen.getByRole("button", { name: "小龍" }));
    const said = screen.getByRole("status").textContent ?? "";
    expect(said.length).toBeGreaterThan(0);
    expect(bannedHits(document.body.textContent ?? "")).toEqual([]);
  });

  it("adopts in three steps with one next button", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AdoptWizard initial={{ name: "", appearance: look }} onSave={onSave} />);
    expect(screen.getAllByRole("button", { name: "下一步" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByRole("heading", { name: "頭上要長什麼？" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "下一步" }));
    await userEvent.type(screen.getByLabelText("角色名字"), "小龍");
    await userEvent.click(screen.getByRole("button", { name: "帶牠回家" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "小龍" }));
    expect(bannedHits(document.body.textContent ?? "")).toEqual([]);
  });

  it("celebrates with one button that keeps the star", async () => {
    const onClose = vi.fn();
    render(<Celebrate fromStars={0} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "做到了" });
    expect(dialog).toHaveTextContent("★ +1");
    expect(dialog).toHaveTextContent("★ 1/3");
    expect(dialog.querySelector("textarea")).toBeNull();
    expect(screen.queryByRole("button", { name: "先不要" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "😆" }));
    await userEvent.click(screen.getByRole("button", { name: "關閉" }));
    expect(onClose).toHaveBeenCalledWith("😆");
  });

  it("greys out keepsakes that are still missing", () => {
    render(<MemoryRouter><CabinetView collected={1} total={2} items={[
      { deedId: "a", districtKey: "music", placeId: "p", placeName: "音樂坊小廣場", object: "吉他撥片", emoji: "🎸", collected: true, createdAt: "2026-11-10T00:00:00.000Z", warmLine: "小雀的吉他撥片。去上了聲樂課。", mood: "😆" },
      { deedId: "b", districtKey: "music", placeId: "p", placeName: "音樂坊小廣場", object: "吉他撥片", emoji: "🎸", collected: false, createdAt: "2026-11-10T00:00:00.000Z" },
    ]} /></MemoryRouter>);
    expect(screen.getByLabelText("收藏進度")).toHaveTextContent("1/9");
    expect(document.querySelectorAll(".keepsake-cell")).toHaveLength(9);
    expect(document.querySelectorAll(".is-missing")).toHaveLength(8);
    expect(screen.queryByText(/明信片/)).not.toBeInTheDocument();
    expect(bannedHits(document.body.textContent ?? "")).toEqual([]);
  });

  it("keeps helpers and deletion inside the folded advanced section", () => {
    state.me = baby();
    render(<MemoryRouter><MePage /></MemoryRouter>);
    const advanced = document.querySelector("details.advanced") as HTMLDetailsElement | null;
    expect(advanced?.open).toBe(false);
    expect(advanced?.textContent).not.toContain("幫手");
    expect(advanced?.textContent).toContain("刪除帳號");
    expect(advanced?.textContent).toContain("開一間小店");
    expect(bannedHits(document.body.textContent?.replace(advanced?.textContent ?? "", "") ?? "")).toEqual([]);
  });
});
