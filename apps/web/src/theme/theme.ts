import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

/** Keep in sync with the inline script in index.html. */
export const THEME_STORAGE_KEY = "hogar-theme";

/**
 * The mobile browser bar's color per theme: the page background (`--ink-25` / `--plum-950` in
 * primitives.css, checked by theme.test.ts). Keep in sync with the inline script in index.html.
 */
export const THEME_COLORS = { light: "#fbf8fa", dark: "#141016" } as const satisfies Record<Theme, string>;

const listeners = new Set<() => void>();
const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return systemQuery().matches ? "dark" : "light";
}

function apply() {
  const theme = resolve(readPreference());
  document.documentElement.dataset["theme"] = theme;
  // Both tags (one per system scheme) follow the app's choice, which may differ from the system.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = THEME_COLORS[theme];
  });
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const query = systemQuery();
  query.addEventListener("change", apply);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", apply);
  };
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  apply();
}

/** The active theme, following the stored choice or the system setting. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => resolve(readPreference()));
  const setTheme = useCallback((next: Theme) => setThemePreference(next), []);
  return { theme, setTheme };
}
