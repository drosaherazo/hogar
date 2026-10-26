import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Avatar, initialsOf } from "./Avatar";

describe("initialsOf", () => {
  it.each([
    ["Ana García", "AG"],
    ["ana", "A"],
    ["  María José  López Ruiz ", "MR"],
    ["élodie durand", "ÉD"],
    ["", ""],
  ])("%s → %s", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe("Avatar", () => {
  it("shows initials and is named after the person", () => {
    render(<Avatar name="Ana García" />);
    expect(screen.getByRole("img", { name: "Ana García" })).toHaveTextContent("AG");
  });

  it("shows the photo when there is one", () => {
    const { container } = render(<Avatar name="Ana García" src="https://example.com/ana.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/ana.jpg");
  });

  it("falls back to initials when the photo fails to load", () => {
    const { container } = render(<Avatar name="Ana García" src="https://example.com/broken.jpg" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ana García" })).toHaveTextContent("AG");
  });

  it("uses the member color", () => {
    render(<Avatar name="Ana" colorIndex={3} />);
    expect(screen.getByRole("img")).toHaveClass("member3");
  });

  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(<Avatar name="Ana" decorative />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <>
        <Avatar name="Ana García" />
        <Avatar name="Marta" src="https://example.com/marta.jpg" size="lg" colorIndex={2} />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
