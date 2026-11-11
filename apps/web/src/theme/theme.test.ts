import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setThemePreference, THEME_COLORS, THEME_STORAGE_KEY } from "./theme";

const themeColorMetas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];

describe("browser bar color", () => {
  beforeEach(() => {
    // The same two tags as index.html: one per system color scheme.
    document.head.innerHTML =
      '<meta name="theme-color" content="#fbf8fa" media="(prefers-color-scheme: light)" />' +
      '<meta name="theme-color" content="#141016" media="(prefers-color-scheme: dark)" />';
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.head.innerHTML = "";
  });

  it("follows a theme chosen in the app, whatever the system says", () => {
    setThemePreference("dark");
    expect(themeColorMetas().map((meta) => meta.content)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);

    setThemePreference("light");
    expect(themeColorMetas().map((meta) => meta.content)).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
  });

  it("matches the page background of each theme in the design tokens", () => {
    // Tests run from apps/web (both `pnpm test` and `pnpm --filter @hogar/web test`).
    const primitives = readFileSync(resolve(process.cwd(), "../../packages/ui/src/tokens/primitives.css"), "utf8");
    const primitive = (name: string) => primitives.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];
    expect(THEME_COLORS.light).toBe(primitive("ink-25"));
    expect(THEME_COLORS.dark).toBe(primitive("plum-950"));
  });
});
