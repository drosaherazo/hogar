import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";
import { contrastPairs } from "./contrastPairs";
import { primitives, resolveToken, themes } from "./parseTokens";

describe.each(Object.entries(themes))("%s theme", (_, theme) => {
  const resolve = (name: string) => resolveToken(name, theme, primitives);

  it.each(contrastPairs)("$usage.en meets AA ($foreground on $background)", (pair) => {
    const ratio = contrastRatio(resolve(pair.foreground), resolve(pair.background));
    expect(ratio).toBeGreaterThanOrEqual(pair.minimum);
  });

  it("member colors share a similar luminance (visual fairness)", () => {
    const luminances = Array.from({ length: 8 }, (_, i) => relativeLuminance(resolve(`--color-member-${i + 1}`)));
    expect(Math.max(...luminances) - Math.min(...luminances)).toBeLessThan(0.1);
  });
});

it("both themes define exactly the same tokens", () => {
  expect([...themes.dark.keys()].sort()).toEqual([...themes.light.keys()].sort());
});

describe("contrastRatio", () => {
  it("returns 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#c4643f", "#c4643f")).toBe(1);
  });

  it("rejects unsupported formats", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});
