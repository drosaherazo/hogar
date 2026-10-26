import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Button } from "./Button";

describe("Button", () => {
  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add expense</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("does not respond while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Create a household
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a labelled spinner and blocks clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Saving" })).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("hides decorative icons from assistive technology", () => {
    render(<Button icon={<svg data-testid="icon" />}>Sign out</Button>);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations in any variant", async () => {
    const { container } = render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
