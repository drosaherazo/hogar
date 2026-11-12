import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../test/axe";
import { CategoryLabel, categoryText } from "./CategoryLabel";

describe("CategoryLabel", () => {
  it("shows the emoji and the name, but screen readers only get the name", () => {
    const { container } = render(<CategoryLabel category={{ id: "cat_rent", name: "Rent", emoji: "🏠" }} />);
    expect(container).toHaveTextContent("🏠Rent");
    expect(screen.getByText("🏠")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Rent")).toBeInTheDocument();
  });

  it("shows just the name for a category without an emoji", () => {
    const { container } = render(<CategoryLabel category={{ id: "cat_dog", name: "Dog", emoji: null }} />);
    expect(container).toHaveTextContent(/^Dog$/);
  });

  it("renders nothing for an expense without a category", () => {
    const { container } = render(<CategoryLabel category={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <main>
        <CategoryLabel category={{ id: "cat_rent", name: "Rent", emoji: "🏠" }} />
      </main>,
    );
    await expectNoA11yViolations(container);
  });
});

describe("categoryText", () => {
  it("puts the emoji before the name, for plain-text places like select options", () => {
    expect(categoryText({ name: "Rent", emoji: "🏠" })).toBe("🏠 Rent");
    expect(categoryText({ name: "Dog", emoji: null })).toBe("Dog");
  });
});
