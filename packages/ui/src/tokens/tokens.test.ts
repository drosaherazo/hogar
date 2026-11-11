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

  it("member colors avoid the brand's pink and magenta hues", () => {
    for (let i = 1; i <= 8; i++) {
      const h = hue(resolve(`--color-member-${i}`));
      expect(h < 290 || h > 350, `member ${i} has hue ${h.toFixed(0)}°`).toBe(true);
    }
  });

  it("member colors share a similar luminance (visual fairness)", () => {
    const luminances = Array.from({ length: 8 }, (_, i) => relativeLuminance(resolve(`--color-member-${i + 1}`)));
    expect(Math.max(...luminances) - Math.min(...luminances)).toBeLessThan(0.1);
  });
});

/** Hue in degrees (0–360) of a `#rrggbb` color. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (h * 60 + 360) % 360;
}

it("both themes define exactly the same tokens", () => {
  expect([...themes.dark.keys()].sort()).toEqual([...themes.light.keys()].sort());
});

describe("contrastRatio", () => {
  it("returns 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#eb2386", "#eb2386")).toBe(1);
  });

  it("accepts the short #rgb form that CSS minifiers produce (#ffffff becomes #fff)", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21);
    expect(contrastRatio("#c2126a", "#fff")).toBe(contrastRatio("#c2126a", "#ffffff"));
  });

  it("rejects unsupported formats", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});
