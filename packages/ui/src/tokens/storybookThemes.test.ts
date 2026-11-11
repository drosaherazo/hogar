import { describe, expect, it } from "vitest";
import { darkColors, lightColors, palette, sidebarIconColors } from "../../.storybook/themes";
import { AA_TEXT, AA_UI, contrastRatio } from "./contrast";
import { primitives } from "./parseTokens";

describe("Storybook brand themes", () => {
  it.each(Object.entries(palette))("mirrors %s exactly from primitives.css", (token, hex) => {
    expect(primitives.get(token)).toBe(hex);
  });

  describe.each([
    ["light", lightColors, sidebarIconColors.light],
    ["dark", darkColors, sidebarIconColors.dark],
  ] as const)("%s theme", (_, colors, icons) => {
    const paletteValues = new Set<string>(Object.values(palette));

    it("only uses palette colors", () => {
      for (const value of [...Object.values(colors), ...Object.values(icons)]) {
        expect(paletteValues).toContain(value);
      }
    });

    it.each(["story", "document"] as const)("paints %s icons visibly on the sidebar", (icon) => {
      expect(contrastRatio(icons[icon], colors.appBg)).toBeGreaterThanOrEqual(AA_UI);
      expect(contrastRatio(icons[icon], colors.appHoverBg)).toBeGreaterThanOrEqual(AA_UI);
    });

    it.each([
      ["textColor", "appBg"],
      ["textColor", "appContentBg"],
      ["textColor", "barBg"],
      ["textMutedColor", "appBg"],
      ["textMutedColor", "appContentBg"],
      ["barTextColor", "barBg"],
      ["barSelectedColor", "barBg"],
      ["colorSecondary", "appBg"],
      ["colorSecondary", "appContentBg"],
      ["inputTextColor", "inputBg"],
      ["textInverseColor", "colorSecondary"],
    ] as const)("%s on %s meets AA for text", (foreground, background) => {
      expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each([
      ["inputBorder", "inputBg"],
      ["buttonBorder", "buttonBg"],
    ] as const)("%s on %s meets AA for UI components", (foreground, background) => {
      expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(AA_UI);
    });
  });
});
