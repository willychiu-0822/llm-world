import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

const base = {
  body: "round",
  accessory: "dragon_horns",
  main: "#F2C6A8",
  accent: "#A9C7DE",
  description: "",
} as const;

describe("Avatar", () => {
  it("draws the chosen body and accessory with an accessible name", () => {
    render(<Avatar appearance={base} name="Nova" />);
    const svg = screen.getByRole("img", { name: "Nova" });
    expect(svg).toHaveAttribute("data-body", "round");
    expect(svg).toHaveAttribute("data-accessory", "dragon_horns");
    expect(svg.querySelector("[data-part='dragon_horns']")).not.toBeNull();
  });

  it("supports every body shape and no accessory", () => {
    for (const body of ["round", "pear", "tall"] as const) {
      const { container, unmount } = render(
        <Avatar appearance={{ ...base, body, accessory: "none" }} name={body} />,
      );
      expect(container.querySelector(`[data-part='body-${body}']`)).not.toBeNull();
      expect(container.querySelector("[data-part='dragon_horns']")).toBeNull();
      unmount();
    }
  });

  it("wears the scarf and backpack on the body, with a different place for each shape", () => {
    const necks = { round: "72", pear: "66", tall: "64" };
    const packs = { round: "74,64", pear: "72,66", tall: "64,56" };
    for (const body of ["round", "pear", "tall"] as const) {
      const { container, unmount } = render(
        <Avatar
          appearance={{ ...base, body, accessory: "leaf" }}
          worn={{ scarf: "cloud", backpack: true }}
          name={body}
        />,
      );
      const svg = container.querySelector("svg");
      const scarf = svg?.querySelector("[data-part='cloud-scarf']");
      const pack = svg?.querySelector("[data-part='backpack']");
      expect(scarf).toHaveAttribute("data-neck", necks[body]);
      expect(scarf?.querySelector("path")?.getAttribute("d")).toContain(` ${necks[body]} `);
      expect(`${pack?.getAttribute("data-x")},${pack?.getAttribute("data-y")}`).toBe(packs[body]);
      expect(pack?.querySelector("rect")).toHaveAttribute("y", packs[body].split(",")[1]);
      unmount();
    }
  });

  it("keeps a single scarf: the cloud one replaces a chosen scarf, and a scarf they already wear is not drawn twice", () => {
    const { container, rerender } = render(
      <Avatar appearance={{ ...base, accessory: "scarf" }} worn={{ scarf: "cloud" }} name="雲" />,
    );
    expect(container.querySelectorAll("[data-part='scarf']")).toHaveLength(0);
    expect(container.querySelector("[data-part='cloud-scarf']")).toHaveAttribute("data-neck", "72");
    rerender(
      <Avatar appearance={{ ...base, accessory: "scarf" }} worn={{ scarf: "fit" }} name="雲" />,
    );
    expect(container.querySelectorAll("[data-part='scarf']")).toHaveLength(1);
    expect(container.querySelector("[data-part='cloud-scarf']")).toBeNull();
    rerender(
      <Avatar
        appearance={{ ...base, body: "tall", accessory: "none" }}
        worn={{ scarf: "fit" }}
        name="高"
      />,
    );
    expect(container.querySelector("[data-part='scarf']")).toHaveAttribute("data-neck", "64");
  });

  it("falls back to a default look for unknown data", () => {
    render(<Avatar appearance={{ body: "x", accessory: "y" } as never} name="?" />);
    expect(screen.getByRole("img", { name: "?" })).toHaveAttribute("data-body", "round");
  });
});
