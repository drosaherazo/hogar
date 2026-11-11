import { describe, expect, it } from "vitest";
import { amountInputValue, parseAmount } from "./money";

describe("amountInputValue", () => {
  it("writes cents the way people type them in each language", () => {
    expect(amountInputValue(770, "en")).toBe("7.70");
    expect(amountInputValue(770, "es")).toBe("7,70");
    expect(amountInputValue(5, "en")).toBe("0.05");
    expect(amountInputValue(10_000_000, "es")).toBe("100000,00");
  });

  it("round-trips through parseAmount", () => {
    for (const cents of [1, 99, 100, 4280, 123_456]) {
      expect(parseAmount(amountInputValue(cents, "es"))).toBe(cents);
      expect(parseAmount(amountInputValue(cents, "en"))).toBe(cents);
    }
  });
});

describe("parseAmount", () => {
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
    expect(parseAmount(text)).toBe(cents);
  });

  it.each(["1.200", "1,234.56", "12.345", "", "   ", "-3", "abc", "12,", ".5", "1 000", "4e3"])(
    "refuses %s",
    (text) => {
      expect(parseAmount(text)).toBeNull();
    },
  );

  it("refuses absurdly long numbers instead of losing precision", () => {
    expect(parseAmount("12345678901234567890")).toBeNull();
  });
});
