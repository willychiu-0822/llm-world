import { DISTRICTS } from "@lj/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TownMap, type MapPlace } from "./TownMap";

const avatar = { body: "round", accessory: "leaf", main: "#F2C6A8", accent: "#A9C7DE", description: "" };

const places: MapPlace[] = [
  ...DISTRICTS.map((d) => ({ id: d.publicPlaceId, kind: "public" as const, districtKey: d.key, name: d.publicPlaceName, roofColor: d.color, slot: 0, isDemo: false, providerName: null, deedCount: 0, trialCount: 0, presence: { total: 0, characters: [] } })),
  { id: "plc_1", kind: "shop", districtKey: "sports", name: "Leo 慢跑站", roofColor: "#A8C8A0", slot: 1, isDemo: false, providerName: "Leo", deedCount: 2, trialCount: 1, presence: { total: 7, characters: Array.from({ length: 5 }, (_, i) => ({ name: `跑者${i}`, appearance: avatar })) } },
];

if (typeof PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

describe("TownMap", () => {
  it("draws all nine districts with their names", () => {
    render(<MemoryRouter><TownMap districts={DISTRICTS} places={places} /></MemoryRouter>);
    for (const d of DISTRICTS) expect(screen.getByTestId(`district-${d.key}`)).toHaveTextContent(d.name);
  });

  it("links every place and shows who is around", () => {
    render(<MemoryRouter><TownMap districts={DISTRICTS} places={places} /></MemoryRouter>);
    const shop = screen.getByRole("link", { name: /Leo 慢跑站/ });
    expect(shop).toHaveAttribute("href", "/places/plc_1");
    const district = screen.getByTestId("district-sports");
    expect(within(district).getAllByRole("img", { name: /在這裡$/ }).length).toBeLessThanOrEqual(3);
    expect(within(district).getByText("+4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /運動場跑道/ })).toHaveAttribute("href", "/places/pub_sports");
  });

  it("has zoom controls", () => {
    render(<MemoryRouter><TownMap districts={DISTRICTS} places={places} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "放大" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "縮小" })).toBeInTheDocument();
  });

  it("dragging the map does not swallow the next tap on a place", () => {
    function Here() {
      return <p>現在在 {useLocation().pathname}</p>;
    }
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <Routes>
          <Route path="/map" element={<TownMap districts={DISTRICTS} places={places} />} />
          <Route path="/places/:id" element={<Here />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "放大" }));
    const svg = screen.getByRole("group", { name: "龍角鎮地圖" });
    const before = svg.querySelector("g")?.getAttribute("transform");
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 80, clientY: 40 });
    expect(svg.querySelector("g")?.getAttribute("transform")).not.toBe(before);
    expect(svg.querySelector("g")?.getAttribute("transform")).not.toBe("translate(0 0) scale(1)");
    // The drag's own click is discarded. A tap that follows immediately — before the
    // zero-delay timer — must still open the place. Playwright does this under load.
    fireEvent.click(svg);
    fireEvent.click(screen.getByRole("link", { name: /手作巷長椅/ }));
    expect(screen.getByText("現在在 /places/pub_crafts")).toBeInTheDocument();
  });
});
