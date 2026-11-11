import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Button } from "../Button/Button";
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

  describe("brand tone", () => {
    it("paints the card in the brand color only when asked", () => {
      const { rerender } = render(<Card data-testid="card">Money</Card>);
      expect(screen.getByTestId("card")).not.toHaveClass("brand");
      rerender(
        <Card data-testid="card" tone="default">
          Money
        </Card>,
      );
      expect(screen.getByTestId("card")).not.toHaveClass("brand");
      rerender(
        <Card data-testid="card" tone="brand">
          Money
        </Card>,
      );
      expect(screen.getByTestId("card")).toHaveClass("card", "brand");
    });

    it("keeps the element, padding and props it was given", () => {
      render(
        <Card tone="brand" as="section" padding="lg" className="extra" aria-labelledby="money-title">
          <h2 id="money-title">Money</h2>
        </Card>,
      );
      const section = screen.getByRole("region", { name: "Money" });
      expect(section).toHaveClass("brand", "padLg", "extra");
    });

    it("has no accessibility violations with a heading, a sentence and actions", async () => {
      const { container } = render(
        <Card tone="brand" as="section" aria-labelledby="money">
          <h2 id="money">Money</h2>
          <p>You're owed €10.70 in total</p>
          <Button>Add expense</Button>
          <Button variant="secondary">See balances</Button>
        </Card>,
      );
      await expectNoA11yViolations(container);
    });
  });
});
