import { render, screen } from "@testing-library/react";
import { addons, mockChannel } from "storybook/preview-api";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeSplit } from "./ThemeSplit";

describe("ThemeSplit", () => {
  beforeEach(() => {
    addons.setChannel(mockChannel());
  });

  it("renders one panel per theme, scoped with data-theme", () => {
    render(<ThemeSplit>{(theme) => <p>content {theme}</p>}</ThemeSplit>);
    expect(screen.getByRole("region", { name: "Light theme" })).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("region", { name: "Dark theme" })).toHaveAttribute("data-theme", "dark");
    expect(screen.getByText("content dark")).toBeInTheDocument();
  });

  it("opts the panels out of Storybook docs typography so page colors can't override theme tokens", () => {
    render(<ThemeSplit>{() => null}</ThemeSplit>);
    for (const panel of screen.getAllByRole("region")) {
      expect(panel.closest(".sb-unstyled")).not.toBeNull();
    }
  });
});
