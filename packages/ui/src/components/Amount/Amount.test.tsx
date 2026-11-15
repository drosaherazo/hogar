import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../locale/LocaleProvider";
import { expectNoA11yViolations } from "../../test/axe";
import { Amount, formatAmount, type AmountCurrency } from "./Amount";

const EUR: AmountCurrency = { code: "EUR", decimals: 2 };
const USD: AmountCurrency = { code: "USD", decimals: 2 };
const COP: AmountCurrency = { code: "COP", decimals: 0 };
const KWD: AmountCurrency = { code: "KWD", decimals: 3 };

// Intl separates "€" and "COP" with a no-break space; written here as \u00a0 so the expectations are exact.
describe("formatAmount", () => {
  it("formats cents as euros for the active locale", () => {
    expect(formatAmount(4280, EUR, "en")).toBe("€42.80");
    expect(formatAmount(4280, EUR, "es")).toBe("42,80\u00a0€");
  });

  it("keeps every cent, with two decimals", () => {
    expect(formatAmount(1, EUR, "en")).toBe("€0.01");
    expect(formatAmount(1000, EUR, "es")).toBe("10,00\u00a0€");
    expect(formatAmount(10_000_000, EUR, "en")).toBe("€100,000.00");
    expect(formatAmount(10_000_000, EUR, "es")).toBe("100.000,00 €");
  });

  it("formats other two-decimal currencies", () => {
    expect(formatAmount(4280, USD, "en")).toBe("$42.80");
    expect(formatAmount(4280, USD, "es")).toBe("42,80\u00a0US$");
  });

  it("formats whole pesos, never with decimals", () => {
    expect(formatAmount(10_000, COP, "en")).toBe("COP\u00a010,000");
    expect(formatAmount(10_000, COP, "es")).toBe("10.000\u00a0COP");
  });

  it("keeps every fils, with three decimals", () => {
    expect(formatAmount(1250, KWD, "en")).toBe("KWD\u00a01.250");
    expect(formatAmount(5, KWD, "es")).toBe("0,005\u00a0KWD");
  });
});

describe("Amount", () => {
  it("shows the amount in the provider's locale", () => {
    render(
      <LocaleProvider locale="es">
        <Amount units={1070} currency={EUR} />
      </LocaleProvider>,
    );
    // Testing Library turns the no-break space Intl puts before "€" into a plain space when it reads the page.
    expect(screen.getByText("10,70 €")).toBeInTheDocument();
  });

  it("shows the amount in its own currency", () => {
    render(
      <LocaleProvider locale="es">
        <Amount units={85_000} currency={COP} />
        <Amount units={4280} currency={USD} />
      </LocaleProvider>,
    );
    expect(screen.getByText("85.000 COP")).toBeInTheDocument();
    expect(screen.getByText("42,80 US$")).toBeInTheDocument();
  });

  it("formats with the provider's formatting locale, which carries the device region", () => {
    render(
      <LocaleProvider locale="es" formattingLocale="es-CO">
        <Amount units={85_000} currency={COP} />
      </LocaleProvider>,
    );
    expect(screen.getByText("$ 85.000")).toBeInTheDocument();
  });

  it("falls back to English outside a provider", () => {
    render(<Amount units={1070} currency={EUR} />);
    expect(screen.getByText("€10.70")).toBeInTheDocument();
  });

  it("lines figures up with tabular numbers", () => {
    render(<Amount units={1070} currency={EUR} />);
    expect(screen.getByText("€10.70")).toHaveClass("amount");
  });

  it.each([EUR, USD, COP])("has no accessibility violations in $code", async (currency) => {
    const { container } = render(
      <p>
        Bruno owes you <Amount units={1070} currency={currency} />
      </p>,
    );
    await expectNoA11yViolations(container);
  });
});
