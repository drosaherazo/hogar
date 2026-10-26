import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("shows its text with the chosen tone", () => {
    render(<Badge tone="warning">Due tomorrow</Badge>);
    expect(screen.getByText("Due tomorrow")).toHaveClass("warning");
  });

  it("is neutral by default", () => {
    render(<Badge>Coming soon</Badge>);
    expect(screen.getByText("Coming soon")).toHaveClass("neutral");
  });

  it("has no accessibility violations in any tone", async () => {
    const { container } = render(
      <>
        <Badge>Coming soon</Badge>
        <Badge tone="positive">Done</Badge>
        <Badge tone="negative">You owe</Badge>
        <Badge tone="warning">Due soon</Badge>
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
