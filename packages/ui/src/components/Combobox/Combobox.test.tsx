import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Combobox, type ComboboxItem } from "./Combobox";

const currencies: ComboboxItem[] = [
  { id: "EUR", label: "Euro", tag: "EUR" },
  { id: "JPY", label: "Japanese Yen", tag: "JPY" },
  { id: "KWD", label: "Kuwaiti Dinar", tag: "KWD" },
  { id: "USD", label: "US Dollar", tag: "USD" },
];

/** The caller owns matching: here by label, or by a country for the dollar. */
function search(query: string): ComboboxItem[] {
  const wanted = query.trim().toLowerCase();
  return currencies.flatMap((item) => {
    if (item.label.toLowerCase().includes(wanted)) return [item];
    if (wanted && "ecuador".includes(wanted) && item.id === "USD") return [{ ...item, detail: "Used in Ecuador" }];
    return [];
  });
}

function Picker({
  onChange = vi.fn(),
  initial = "EUR",
  error,
}: {
  onChange?: (id: string) => void;
  initial?: string;
  error?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Combobox
        label="Currency"
        hint="Search by name or country."
        error={error}
        search={search}
        selectedId={value}
        onSelectionChange={(id) => {
          setValue(id);
          onChange(id);
        }}
        noResults={(query) => `Nothing matches “${query}”.`}
        triggerLabel="Show all currencies"
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

describe("Combobox", () => {
  it("is a labelled combobox showing the chosen option, described by its hint", () => {
    render(<Picker />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    expect(input).toHaveValue("Euro");
    expect(input).toHaveAccessibleDescription("Search by name or country.");
  });

  it("lists every option from its button, with the tag beside each name", async () => {
    render(<Picker />);
    await userEvent.click(screen.getByRole("button", { name: /Show all currencies/ }));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "EuroEUR",
      "Japanese YenJPY",
      "Kuwaiti DinarKWD",
      "US DollarUSD",
    ]);
  });

  it("narrows the options with what the person types, and picks one", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.clear(input);
    await userEvent.type(input, "yen");
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Japanese YenJPY"]);
    await userEvent.click(screen.getByRole("option", { name: /Japanese Yen/ }));
    expect(onChange).toHaveBeenCalledWith("JPY");
    expect(input).toHaveValue("Japanese Yen");
  });

  it("shows why an option matched when the caller says so", async () => {
    render(<Picker />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.clear(input);
    await userEvent.type(input, "ecua");
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("US DollarUSDUsed in Ecuador");
  });

  it("is used with the keyboard alone", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.clear(input);
    await userEvent.type(input, "d");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("KWD");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("says, in the list, when nothing matches", async () => {
    render(<Picker />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.clear(input);
    await userEvent.type(input, "zzz");
    expect(await screen.findByRole("listbox")).toHaveTextContent("Nothing matches “zzz”.");
    // Announced too, since the message sits inside the list rather than in the field.
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("Nothing matches “zzz”.");
    expect(screen.queryByRole("option", { name: /Euro/ })).not.toBeInTheDocument();
  });

  it("goes back to the chosen option when the person leaves half-typed text", async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.clear(input);
    await userEvent.type(input, "kuw");
    await userEvent.tab();
    await waitFor(() => expect(input).toHaveValue("Euro"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows a selection changed from outside", () => {
    const { rerender } = render(
      <Combobox
        label="Currency"
        search={search}
        selectedId="EUR"
        onSelectionChange={vi.fn()}
        noResults={() => ""}
        triggerLabel="All"
      />,
    );
    rerender(
      <Combobox
        label="Currency"
        search={search}
        selectedId="USD"
        onSelectionChange={vi.fn()}
        noResults={() => ""}
        triggerLabel="All"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("US Dollar");
  });

  it("links the error before the hint and marks the field invalid", () => {
    render(<Picker error="Choose a currency from the list." />);
    const input = screen.getByRole("combobox", { name: "Currency" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Choose a currency from the list. Search by name or country.");
  });

  it("has no accessibility violations, closed or open", async () => {
    const { container } = render(<Picker error="Choose a currency from the list." />);
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole("button", { name: /Show all currencies/ }));
    await screen.findByRole("listbox");
    await expectNoA11yViolations(document.body);
  });
});
