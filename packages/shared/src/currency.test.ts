import { describe, expect, it } from "vitest";
import { amountInputValue, CURRENCY_CODES, currency, parseAmount, suggestCurrency } from "./currency";

const EUR = currency("EUR");
const COP = currency("COP");

describe("the curated currency list", () => {
  it("records the decimals people actually use, departing from ISO 4217 where everyday use does", () => {
    // Worked out by hand in spec #57; COP and ARS have 2 decimals in ISO but nobody uses them.
    expect(Object.fromEntries(CURRENCY_CODES.map((code) => [code, currency(code).decimals]))).toEqual({
      EUR: 2,
      USD: 2,
      GBP: 2,
      CHF: 2,
      MXN: 2,
      BRL: 2,
      PEN: 2,
      COP: 0,
      CLP: 0,
      ARS: 0,
    });
  });
});

describe("parseAmount in a currency with two decimals", () => {
  it.each([
    ["42.80", 4280],
    ["42,80", 4280],
    ["42", 4200],
    ["0,5", 50],
    ["0.05", 5],
    [" 12,50 ", 1250],
    ["100000", 10_000_000],
    ["0.29", 29],
    ["1.1", 110],
  ])("reads %s as %i cents", (text, cents) => {
    expect(parseAmount(text, EUR)).toBe(cents);
  });

  it.each(["1.200", "1,234.56", "12.345", "", "   ", "-3", "abc", "12,", ".5", "1 000", "4e3"])(
    "refuses %s rather than guess",
    (text) => {
      expect(parseAmount(text, EUR)).toBeNull();
    },
  );

  it("refuses absurdly long numbers instead of losing precision", () => {
    expect(parseAmount("12345678901234567890", EUR)).toBeNull();
  });
});

describe("parseAmount in a currency without decimals (COP)", () => {
  it.each([
    ["85.000", 85_000],
    ["85,000", 85_000],
    ["85000", 85_000],
    ["1.234.567", 1_234_567],
    [" 30.000.000 ", 30_000_000],
    ["7", 7],
  ])("reads %s as %i whole pesos", (text, pesos) => {
    expect(parseAmount(text, COP)).toBe(pesos);
  });

  it.each(["12,50", "85.5", "85.0000", "1.23.456", ".500", "500.", "", "-3", "abc", "85 000"])(
    "refuses %s rather than misread centavos",
    (text) => {
      expect(parseAmount(text, COP)).toBeNull();
    },
  );

  it("refuses absurdly long numbers instead of losing precision", () => {
    expect(parseAmount("12345678901234567890", COP)).toBeNull();
  });
});

describe("amountInputValue", () => {
  it("writes cents the way people type them in each language", () => {
    expect(amountInputValue(770, EUR, "en")).toBe("7.70");
    expect(amountInputValue(770, EUR, "es")).toBe("7,70");
    expect(amountInputValue(5, EUR, "en")).toBe("0.05");
    expect(amountInputValue(10_000_000, EUR, "es")).toBe("100000,00");
  });

  it("writes whole pesos as plain digits", () => {
    expect(amountInputValue(85_000, COP, "es")).toBe("85000");
    expect(amountInputValue(7, COP, "en")).toBe("7");
  });

  it("round-trips through parseAmount in every listed currency and language", () => {
    for (const code of CURRENCY_CODES) {
      for (const units of [1, 99, 100, 4280, 123_456, 1_000_000_000]) {
        for (const language of ["en", "es"] as const) {
          expect(parseAmount(amountInputValue(units, currency(code), language), currency(code))).toBe(units);
        }
      }
    }
  });
});

describe("suggestCurrency", () => {
  it.each([
    [["es-CO"], "COP"],
    [["es-ES"], "EUR"],
    [["en-US"], "USD"],
    [["en-GB"], "GBP"],
    [["de-CH"], "CHF"],
    [["es-MX"], "MXN"],
    [["pt-BR"], "BRL"],
    [["es-PE"], "PEN"],
    [["es-CL"], "CLP"],
    [["es-AR"], "ARS"],
    [["fr-FR"], "EUR"],
    [["es-EC"], "USD"],
  ])("suggests from the device region (%j → %s)", (languages, code) => {
    expect(suggestCurrency(languages)).toBe(code);
  });

  it("takes the first language whose region it knows", () => {
    expect(suggestCurrency(["es", "es-419", "es-CO", "en-US"])).toBe("COP");
  });

  it("suggests euros when no region is known or given", () => {
    expect(suggestCurrency(["ja-JP"])).toBe("EUR");
    expect(suggestCurrency(["es", "en"])).toBe("EUR");
    expect(suggestCurrency([])).toBe("EUR");
  });
});
