import { describe, expect, it } from "vitest";
import { parseAmount } from "./money";

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
