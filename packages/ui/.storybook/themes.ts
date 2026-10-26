import { create } from "storybook/theming/create";

/**
 * Hogar brand themes for Storybook's own interface (sidebar, toolbar, panels, docs pages).
 *
 * The manager can't read CSS variables, so the palette is mirrored here as hex values.
 * `src/tokens/storybookThemes.test.ts` checks that every value matches `primitives.css`
 * and that text meets AA, so a palette change can't silently leave Storybook behind.
 */
export const palette = {
  "--sand-0": "#fffdf9",
  "--sand-50": "#fbf7f2",
  "--sand-100": "#f3ebdf",
  "--sand-200": "#e8dccb",
  "--sand-400": "#97846f",
  "--sand-600": "#6b5a4c",
  "--sand-900": "#2e241d",
  "--earth-950": "#1c1714",
  "--earth-900": "#28211c",
  "--earth-800": "#332a24",
  "--earth-700": "#463a30",
  "--earth-500": "#8a7765",
  "--earth-300": "#bfae9c",
  "--earth-100": "#f3eae0",
  "--terracotta-200": "#eeab8b",
  "--terracotta-300": "#e5906a",
  "--terracotta-600": "#a9502f",
  "--terracotta-700": "#8c4126",
} as const;

const FONT_BASE = '"Figtree Variable", system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_CODE = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
/** Storybook renders `brandTitle` as HTML when there's no `brandImage`: the mark plus a wordmark in Figtree. */
const brandTitle = (mark: string) =>
  `<span style="display:inline-flex;align-items:center;gap:10px;font-size:16px;font-weight:600">` +
  `<img src="/brand/${mark}" width="28" height="28" alt="" />Hogar` +
  `<span style="font-weight:400;opacity:0.75">· Design system</span></span>`;

export const lightColors = {
  colorPrimary: palette["--terracotta-600"],
  colorSecondary: palette["--terracotta-600"],
  appBg: palette["--sand-100"],
  appContentBg: palette["--sand-50"],
  appPreviewBg: palette["--sand-50"],
  appHoverBg: palette["--sand-200"],
  appBorderColor: palette["--sand-200"],
  textColor: palette["--sand-900"],
  textMutedColor: palette["--sand-600"],
  textInverseColor: palette["--sand-0"],
  barBg: palette["--sand-0"],
  barTextColor: palette["--sand-600"],
  barHoverColor: palette["--terracotta-700"],
  barSelectedColor: palette["--terracotta-600"],
  buttonBg: palette["--sand-0"],
  buttonBorder: palette["--sand-400"],
  booleanBg: palette["--sand-100"],
  booleanSelectedBg: palette["--sand-0"],
  inputBg: palette["--sand-0"],
  inputBorder: palette["--sand-400"],
  inputTextColor: palette["--sand-900"],
} as const;

export const darkColors = {
  colorPrimary: palette["--terracotta-300"],
  colorSecondary: palette["--terracotta-300"],
  appBg: palette["--earth-900"],
  appContentBg: palette["--earth-950"],
  appPreviewBg: palette["--earth-950"],
  appHoverBg: palette["--earth-800"],
  appBorderColor: palette["--earth-700"],
  textColor: palette["--earth-100"],
  textMutedColor: palette["--earth-300"],
  textInverseColor: palette["--earth-950"],
  barBg: palette["--earth-950"],
  barTextColor: palette["--earth-300"],
  barHoverColor: palette["--terracotta-200"],
  barSelectedColor: palette["--terracotta-300"],
  buttonBg: palette["--earth-800"],
  buttonBorder: palette["--earth-500"],
  booleanBg: palette["--earth-950"],
  booleanSelectedBg: palette["--earth-700"],
  inputBg: palette["--earth-800"],
  inputBorder: palette["--earth-500"],
  inputTextColor: palette["--earth-100"],
} as const;

const shared = {
  fontBase: FONT_BASE,
  fontCode: FONT_CODE,
  appBorderRadius: 12,
  inputBorderRadius: 8,
  brandUrl: "/",
  brandTarget: "_self",
};

export const hogarLight = create({
  base: "light",
  ...shared,
  ...lightColors,
  brandTitle: brandTitle("hogar-mark-light.svg"),
});

export const hogarDark = create({
  base: "dark",
  ...shared,
  ...darkColors,
  brandTitle: brandTitle("hogar-mark-dark.svg"),
});

export type ThemeName = "light" | "dark";

export const storybookThemes: Record<ThemeName, typeof hogarLight> = {
  light: hogarLight,
  dark: hogarDark,
};

/** Theme stored in the toolbar, or the system preference when none was chosen. */
export function resolveThemeName(value: unknown): ThemeName {
  if (value === "light" || value === "dark") return value;
  const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}
