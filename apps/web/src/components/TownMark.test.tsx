import { KEEPSAKES, LIFE_ACTIVITIES, TOWN_SIGHTS } from "@lj/core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TownMark, UI_MARKS, type MarkName } from "./TownMark";

describe("TownMark", () => {
  it("draws every keepsake, souvenir, sight and navigation mark as its own svg", () => {
    const names = [
      ...Object.values(KEEPSAKES).map((kind) => kind.key),
      ...LIFE_ACTIVITIES.map((activity) => activity.id),
      ...TOWN_SIGHTS.map((sight) => sight.mark),
      ...UI_MARKS,
    ];
    const seen = new Set<MarkName>();
    for (const name of names) {
      const mark: MarkName = name;
      seen.add(mark);
      const { container, unmount } = render(<TownMark name={mark} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("data-mark", mark);
      expect(svg?.querySelector("text")).toBeNull();
      expect(svg?.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
      unmount();
    }
    expect(seen.size).toBe(new Set(names).size);
    expect(seen.size).toBeGreaterThanOrEqual(9 + 7 + 6 + UI_MARKS.length - 2);
  });
});
