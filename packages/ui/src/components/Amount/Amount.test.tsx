import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../locale/LocaleProvider";
import { expectNoA11yViolations } from "../../test/axe";
import { Amount, formatAmount } from "./Amount";

describe("formatAmount", () => {
  it("formats cents as euros for the active locale", () => {
    expect(formatAmount(4280, "en")).toBe("€42.80");
    expect(formatAmount(4280, "es")).toBe("42,80 €");
  });

  it("keeps every cent, with two decimals", () => {
    expect(formatAmount(1, "en")).toBe("€0.01");
    expect(formatAmount(1000, "es")).toBe("10,00 €");
    expect(formatAmount(10_000_000, "en")).toBe("€100,000.00");
    expect(formatAmount(10_000_000, "es")).toBe("100.000,00 €");
  });
});

describe("Amount", () => {
  it("shows the amount in the provider's locale", () => {
    render(
      <LocaleProvider locale="es">
        <Amount cents={1070} />
      </LocaleProvider>,
    );
    // Testing Library turns the no-break space Intl puts before "€" into a plain space when it reads the page.
    expect(screen.getByText("10,70 €")).toBeInTheDocument();
  });

  it("falls back to English outside a provider", () => {
    render(<Amount cents={1070} />);
    expect(screen.getByText("€10.70")).toBeInTheDocument();
  });

  it("lines figures up with tabular numbers", () => {
    render(<Amount cents={1070} />);
    expect(screen.getByText("€10.70")).toHaveClass("amount");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <p>
        Bruno owes you <Amount cents={1070} />
      </p>,
    );
    await expectNoA11yViolations(container);
  });
});
