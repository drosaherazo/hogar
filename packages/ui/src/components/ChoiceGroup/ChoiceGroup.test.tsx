import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { ChoiceGroup } from "./ChoiceGroup";

const methods = [
  { value: "weights", label: "The household's split", hint: "Ana 75 %, Bruno 25 %" },
  { value: "equal", label: "Equally between…" },
  { value: "exact", label: "Exact amounts", disabled: true, hint: "Coming soon" },
];

function Single({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("weights");
  return (
    <ChoiceGroup
      legend="How should it be split?"
      options={methods}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const people = [
  { value: "ana", label: "Ana" },
  { value: "bruno", label: "Bruno", trailing: <span>€5.00</span> },
  { value: "carla", label: "Carla" },
];

function Multiple({ onChange = vi.fn() }: { onChange?: (value: string[]) => void }) {
  const [value, setValue] = useState(["ana", "bruno"]);
  return (
    <ChoiceGroup
      multiple
      legend="Who shares it?"
      options={people}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("ChoiceGroup (single choice)", () => {
  it("is a group of radios named by its legend", () => {
    render(<Single />);
    const group = screen.getByRole("group", { name: "How should it be split?" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "The household's split" })).toBeChecked();
  });

  it("reports the chosen value", async () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Equally between…" }));
    expect(onChange).toHaveBeenCalledWith("equal");
    expect(screen.getByRole("radio", { name: "Equally between…" })).toBeChecked();
  });

  it("links each option's hint so it is read with the option", () => {
    render(<Single />);
    expect(screen.getByRole("radio", { name: "The household's split" })).toHaveAccessibleDescription(
      "Ana 75 %, Bruno 25 %",
    );
  });

  it("keeps disabled options readable but not selectable", async () => {
    const onChange = vi.fn();
    render(<Single onChange={onChange} />);
    const exact = screen.getByRole("radio", { name: "Exact amounts" });
    expect(exact).toBeDisabled();
    expect(exact).toHaveAccessibleDescription("Coming soon");
    await userEvent.click(exact);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands the selected option to `initialFocusRef`, so a dialog can start there", () => {
    const ref = createRef<HTMLInputElement>();
    render(<ChoiceGroup legend="Role" options={methods} value="equal" onChange={() => {}} initialFocusRef={ref} />);
    expect(ref.current).toBe(screen.getByRole("radio", { name: "Equally between…" }));
  });
});

describe("ChoiceGroup (multiple)", () => {
  it("is a group of checkboxes", () => {
    render(<Multiple />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("checkbox", { name: /Ana/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Carla/ })).not.toBeChecked();
  });

  it("adds and removes values, keeping the options' order", async () => {
    const onChange = vi.fn();
    render(<Multiple onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Carla/ }));
    expect(onChange).toHaveBeenLastCalledWith(["ana", "bruno", "carla"]);
    await userEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    expect(onChange).toHaveBeenLastCalledWith(["bruno", "carla"]);
  });

  it("shows trailing content, such as each person's share", () => {
    render(<Multiple />);
    expect(screen.getByText("€5.00")).toBeInTheDocument();
  });
});

describe("ChoiceGroup accessibility", () => {
  it("has no violations in either mode", async () => {
    const { container } = render(
      <>
        <Single />
        <Multiple />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
