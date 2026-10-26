import { describe, expect, it } from "vitest";
import { isLocale, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it.each([
    ["es", "es"],
    ["es-ES", "es"],
    ["ES-mx", "es"],
    ["en-GB", "en"],
    ["es-ES,es;q=0.9,en;q=0.8", "es"],
    ["fr-FR,fr;q=0.9,es;q=0.8,en;q=0.7", "es"],
    ["en;q=0.5,es;q=0.9", "es"],
  ])("resolves %s to %s", (input, expected) => {
    expect(resolveLocale(input)).toBe(expected);
  });

  it.each([undefined, null, "", "fr", "de-DE,fr;q=0.8", "*"])("falls back to en for %s", (input) => {
    expect(resolveLocale(input)).toBe("en");
  });
});

describe("isLocale", () => {
  it("accepts supported locales only", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("es-ES")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});
