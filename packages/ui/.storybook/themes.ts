import { create } from "storybook/theming/create";

/**
 * Hogar brand themes for Storybook's own interface (sidebar, toolbar, panels, docs pages).
 *
 * The manager can't read CSS variables, so the palette is mirrored here as hex values.
 * `src/tokens/storybookThemes.test.ts` checks that every value matches `primitives.css`
 * and that text meets AA, so a palette change can't silently leave Storybook behind.
 */
export const palette = {
  "--fuchsia-300": "#ff8cc4",
  "--fuchsia-400": "#f4519f",
  "--fuchsia-600": "#c2126a",
  "--fuchsia-700": "#9e0e56",
  "--ink-0": "#ffffff",
  "--ink-25": "#fbf8fa",
  "--ink-50": "#f4eff3",
  "--ink-100": "#e9e2e7",
  "--ink-400": "#8b7f88",
  "--ink-600": "#5d5360",
  "--ink-900": "#1f1a21",
  "--plum-950": "#141016",
  "--plum-900": "#1e1921",
  "--plum-800": "#29222c",
  "--plum-700": "#3e3443",
  "--plum-500": "#857a8b",
  "--plum-300": "#c3b8c7",
  "--plum-50": "#f7f2f8",
  "--teal-300": "#5fd6c2",
  "--teal-700": "#0f6f68",
  "--amber-300": "#f5c542",
  "--amber-700": "#8a5a06",
} as const;

const FONT_BASE = '"Figtree Variable", system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_CODE = 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';
/** Storybook renders `brandTitle` as HTML when there's no `brandImage`: the mark plus a wordmark in Figtree. */
const brandTitle = (mark: string) =>
  `<span style="display:inline-flex;align-items:center;gap:10px;font-size:16px;font-weight:600">` +
  `<img src="/brand/${mark}" width="28" height="28" alt="" />Hogar` +
  `<span style="font-weight:400;opacity:0.75">· Design system</span></span>`;

export const lightColors = {
  colorPrimary: palette["--fuchsia-600"],
  colorSecondary: palette["--fuchsia-600"],
  appBg: palette["--ink-50"],
  appContentBg: palette["--ink-25"],
  appPreviewBg: palette["--ink-25"],
  appHoverBg: palette["--ink-100"],
  appBorderColor: palette["--ink-100"],
  textColor: palette["--ink-900"],
  textMutedColor: palette["--ink-600"],
  textInverseColor: palette["--ink-0"],
  barBg: palette["--ink-0"],
  barTextColor: palette["--ink-600"],
  barHoverColor: palette["--fuchsia-700"],
  barSelectedColor: palette["--fuchsia-600"],
  buttonBg: palette["--ink-0"],
  buttonBorder: palette["--ink-400"],
  booleanBg: palette["--ink-50"],
  booleanSelectedBg: palette["--ink-0"],
  inputBg: palette["--ink-0"],
  inputBorder: palette["--ink-400"],
  inputTextColor: palette["--ink-900"],
} as const;

export const darkColors = {
  colorPrimary: palette["--fuchsia-300"],
  colorSecondary: palette["--fuchsia-300"],
  appBg: palette["--plum-900"],
  appContentBg: palette["--plum-950"],
  appPreviewBg: palette["--plum-950"],
  appHoverBg: palette["--plum-800"],
  appBorderColor: palette["--plum-700"],
  textColor: palette["--plum-50"],
  textMutedColor: palette["--plum-300"],
  textInverseColor: palette["--plum-950"],
  barBg: palette["--plum-950"],
  barTextColor: palette["--plum-300"],
  barHoverColor: palette["--fuchsia-400"],
  barSelectedColor: palette["--fuchsia-300"],
  buttonBg: palette["--plum-800"],
  buttonBorder: palette["--plum-500"],
  booleanBg: palette["--plum-950"],
  booleanSelectedBg: palette["--plum-700"],
  inputBg: palette["--plum-800"],
  inputBorder: palette["--plum-500"],
  inputTextColor: palette["--plum-50"],
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

/**
 * Sidebar icons for stories and docs pages. Storybook paints them in fixed colors (seafoam and
 * orange) that `create()` can't change, so `manager.ts` repaints them with these: teal and amber,
 * the brand's closest equivalents. Component icons already follow `colorSecondary`.
 */
export const sidebarIconColors: Record<ThemeName, { story: string; document: string }> = {
  light: { story: palette["--teal-700"], document: palette["--amber-700"] },
  dark: { story: palette["--teal-300"], document: palette["--amber-300"] },
};

/** Theme stored in the toolbar, or the system preference when none was chosen. */
export function resolveThemeName(value: unknown): ThemeName {
  if (value === "light" || value === "dark") return value;
  const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}
