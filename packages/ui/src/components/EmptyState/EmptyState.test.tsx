import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Button } from "../Button/Button";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("is a section named by its title, with description and actions", () => {
    render(
      <EmptyState
        title="The list is empty"
        description="What's missing at home?"
        actions={<Button>Add item</Button>}
      />,
    );
    const section = screen.getByRole("region", { name: "The list is empty" });
    expect(section).toHaveTextContent("What's missing at home?");
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("uses the requested heading level", () => {
    render(<EmptyState title="Nothing yet" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3, name: "Nothing yet" })).toBeInTheDocument();
  });

  it("hides the decorative icon", () => {
    render(<EmptyState title="Nothing yet" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <EmptyState
        title="No household yet"
        description="Create one or join with an invitation."
        icon={<svg />}
        actions={<Button>Create a household</Button>}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
