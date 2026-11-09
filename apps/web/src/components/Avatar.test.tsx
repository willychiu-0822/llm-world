import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar";

const base = { body: "round", accessory: "dragon_horns", main: "#F2C6A8", accent: "#A9C7DE", description: "" } as const;

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
      const { container, unmount } = render(<Avatar appearance={{ ...base, body, accessory: "none" }} name={body} />);
      expect(container.querySelector(`[data-part='body-${body}']`)).not.toBeNull();
      expect(container.querySelector("[data-part='dragon_horns']")).toBeNull();
      unmount();
    }
  });

  it("falls back to a default look for unknown data", () => {
    render(<Avatar appearance={{ body: "x", accessory: "y" } as never} name="?" />);
    expect(screen.getByRole("img", { name: "?" })).toHaveAttribute("data-body", "round");
  });
});
