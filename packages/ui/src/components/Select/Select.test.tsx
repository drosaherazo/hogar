import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Select } from "./Select";

const people = [
  { value: "ana", label: "Ana García" },
  { value: "bruno", label: "Bruno Díaz" },
];

describe("Select", () => {
  it("is labelled by its visible label and lists the options", () => {
    render(<Select label="Who paid?" options={people} defaultValue="ana" />);
    const select = screen.getByRole("combobox", { name: "Who paid?" });
    expect(select).toHaveValue("ana");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Ana García", "Bruno Díaz"]);
  });

  it("reports the chosen option", async () => {
    const onChange = vi.fn();
    render(<Select label="Who paid?" options={people} defaultValue="ana" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "bruno");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox")).toHaveValue("bruno");
  });

  it("links the hint and the error, error first, and marks the field invalid", () => {
    render(
      <Select
        label="Who received it?"
        options={people}
        hint="Anyone in the household."
        error="Choose two different people."
      />,
    );
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Choose two different people. Anyone in the household.");
  });

  it("can disable an option", () => {
    render(<Select label="Who paid?" options={[...people, { value: "carla", label: "Carla", disabled: true }]} />);
    expect(screen.getByRole("option", { name: "Carla" })).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <>
        <Select label="Who paid?" options={people} />
        <Select label="Who received it?" options={people} error="Choose two different people." />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
