import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("is a checkbox labelled by its visible label", () => {
    render(<Checkbox label="Use its own split" />);
    expect(screen.getByRole("checkbox", { name: "Use its own split" })).not.toBeChecked();
  });

  it("toggles when the box or its label is clicked, and with the space bar", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Use its own split" onChange={onChange} />);
    const box = screen.getByRole("checkbox");

    await userEvent.click(screen.getByText("Use its own split"));
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(box).not.toBeChecked();
    box.focus();
    await userEvent.keyboard(" ");
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("can be controlled", () => {
    render(<Checkbox label="Use its own split" checked onChange={() => undefined} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("does nothing while disabled", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Use its own split" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("links the hint so screen readers read it with the box", () => {
    render(<Checkbox label="Use its own split" hint="If unticked, it follows the household's split." />);
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription("If unticked, it follows the household's split.");
  });

  it("has no accessibility violations, ticked or not", async () => {
    const { container } = render(
      <>
        <Checkbox label="Use its own split" hint="If unticked, it follows the household's split." />
        <Checkbox label="Another choice" defaultChecked />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
