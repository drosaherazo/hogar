import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("is labelled by its visible label", () => {
    render(<TextField label="Household name" />);
    expect(screen.getByRole("textbox", { name: "Household name" })).toBeInTheDocument();
  });

  it("passes typing through to onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Household name" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "Casa");
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("links the hint so screen readers read it with the field", () => {
    render(<TextField label="Household name" hint="You can change it later." />);
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("You can change it later.");
  });

  it("marks the field invalid and announces the error", () => {
    render(<TextField label="Household name" hint="Up to 50 characters." error="Give your household a name." />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Give your household a name. Up to 50 characters.");
  });

  it("supports numeric input for weights", () => {
    render(<TextField label="Ana's weight" type="number" min={0} max={100} defaultValue={3} />);
    const input = screen.getByRole("spinbutton", { name: "Ana's weight" });
    expect(input).toHaveValue(3);
    expect(input).toHaveAttribute("max", "100");
  });

  it("has no accessibility violations, with and without an error", async () => {
    const { container } = render(
      <>
        <TextField label="Name" hint="Up to 50 characters." />
        <TextField label="Other name" error="Give your household a name." />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
