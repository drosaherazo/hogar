import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its content as a div by default", () => {
    const { container } = render(<Card>Groceries</Card>);
    expect(container.firstChild?.nodeName).toBe("DIV");
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("can be a labelled section", () => {
    render(
      <Card as="section" aria-labelledby="title">
        <h2 id="title">Balance</h2>
      </Card>,
    );
    expect(screen.getByRole("region", { name: "Balance" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Card padding="lg" elevated>
        <p>Content</p>
      </Card>,
    );
    await expectNoA11yViolations(container);
  });
});
