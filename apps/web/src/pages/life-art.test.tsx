import type { LifeActivityId, LifeView } from "@lj/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LifeShelf } from "../components/LifeShelf";
import { LifePage } from "./Life";

const life = vi.hoisted(() => {
  const row = (
    id: LifeActivityId,
    name: string,
    reward: string,
    category: string,
    open: boolean,
  ) => ({
    id,
    name,
    place: "鎮上",
    wish: "想出去。",
    help: "陪我一下？",
    story: `${name}的故事。`,
    reward,
    category,
    done: false,
    open,
  });
  const view: LifeView = {
    day: "2026-11-14",
    season: "秋",
    period: "早晨",
    today: {
      day: "2026-11-14",
      autonomous: "早些時候，小龍曬了太陽。",
      entries: [{ activityId: "music", at: "2026-11-14T01:00:00.000Z", story: "阿芽敲了三下鈴。" }],
    },
    history: [
      {
        day: "2026-11-14",
        autonomous: "早些時候，小龍曬了太陽。",
        entries: [
          { activityId: "music", at: "2026-11-14T01:00:00.000Z", story: "阿芽敲了三下鈴。" },
        ],
      },
    ],
    inventory: [{ activityId: "shop", earnedOn: "2026-11-14" }],
    outfit: null,
    decoration: null,
    allowVisits: false,
    mood: "悠閒",
    wish: "想換個新樣子。",
    help: "幫我挑一條軟軟的圍巾？",
    scene: "秋天的早晨，落葉在腳邊打了個轉。",
    recommendedId: "music",
    activities: [
      row("shop", "逛逛小店", "雲朵圍巾", "衣服", true),
      row("exercise", "河邊動一動", "葉子哨", "旅行紀念品", false),
      row("music", "聽一首小曲", "小鈴鐺", "旅行紀念品", true),
      row("visit", "去朋友家喝茶", "小栗的茶杯墊", "朋友送的", false),
      row("festival", "廣場湊熱鬧", "四季小燈", "房間佈置", false),
      row("town", "去霧丘鎮旅行", "霧丘車票夾", "旅行紀念品", false),
      row("abroad", "去星砂島出國玩", "星砂瓶", "旅行紀念品", false),
    ] as LifeView["activities"],
    encounter: { kind: "town", name: "小栗" },
    inspiration: null,
  };
  return view as LifeView;
});

vi.mock("../lib/session", () => ({
  useSession: () => ({
    me: {
      character: {
        id: "c",
        name: "小龍",
        appearance: {
          body: "round",
          accessory: "none",
          main: "#F2C6A8",
          accent: "#A9C7DE",
          description: "",
        },
        personality: "",
        sharing: { allowAiQuotes: false },
      },
    },
    reload: vi.fn(),
  }),
}));

vi.mock("../lib/useFetch", () => ({
  useFetch: () => ({ data: life, error: null, loading: false, reload: vi.fn(), setData: vi.fn() }),
}));

const pictured = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;

describe("life pictures", () => {
  it("shows the seven souvenirs as drawings, and the day's choices too", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <LifeShelf />
      </MemoryRouter>,
    );
    expect(document.querySelectorAll(".life-shelf [data-mark]")).toHaveLength(7);
    expect(document.querySelector("[data-mark='shop']")).not.toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(pictured);
    unmount();

    render(
      <MemoryRouter>
        <LifePage />
      </MemoryRouter>,
    );
    expect(document.querySelector(".life-entry [data-mark='music']")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "陪牠去玩" }));
    expect(screen.getByRole("radio", { name: "逛逛小店" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "河邊動一動 · 今天沒開" })).toBeDisabled();
    expect(document.querySelectorAll(".life-choices [data-mark]")).toHaveLength(7);
    expect(document.body.textContent ?? "").not.toMatch(pictured);
  });

  it("日子寫成「11 月 14 日，秋天的早晨」，畫面上沒有 YYYY-MM-DD", async () => {
    const originalHistory = life.history;
    life.history = [
      originalHistory[0]!,
      { day: "2026-11-13", autonomous: "昨天去散步。", entries: [] },
    ];
    try {
      const { unmount } = render(
        <MemoryRouter>
          <LifePage />
        </MemoryRouter>,
      );
      expect(screen.getByText("11 月 14 日，秋天的早晨")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "11 月 13 日，秋天" })).toBeInTheDocument();
      expect(document.body.textContent ?? "").not.toMatch(/\d{4}-\d{2}-\d{2}/);
      unmount();

      render(
        <MemoryRouter>
          <LifeShelf />
        </MemoryRouter>,
      );
      await userEvent.click(screen.getByRole("button", { name: "雲朵圍巾，已收集" }));
      expect(screen.getByText(/11 月 14 日，秋天/)).toBeInTheDocument();
      expect(document.body.textContent ?? "").not.toMatch(/\d{4}-\d{2}-\d{2}/);
    } finally {
      life.history = originalHistory;
    }
  });
});
