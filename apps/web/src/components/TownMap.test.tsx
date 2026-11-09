import { DISTRICTS } from "@lj/core";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TownMap, type MapPlace } from "./TownMap";

const avatar = { body: "round", accessory: "leaf", main: "#F2C6A8", accent: "#A9C7DE", description: "" };

const places: MapPlace[] = [
  ...DISTRICTS.map((d) => ({ id: d.publicPlaceId, kind: "public" as const, districtKey: d.key, name: d.publicPlaceName, roofColor: d.color, slot: 0, isDemo: false, providerName: null, deedCount: 0, trialCount: 0, presence: { total: 0, characters: [] } })),
  { id: "plc_1", kind: "shop", districtKey: "sports", name: "Leo 慢跑站", roofColor: "#A8C8A0", slot: 1, isDemo: false, providerName: "Leo", deedCount: 2, trialCount: 1, presence: { total: 7, characters: Array.from({ length: 5 }, (_, i) => ({ name: `跑者${i}`, appearance: avatar })) } },
];

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
});
