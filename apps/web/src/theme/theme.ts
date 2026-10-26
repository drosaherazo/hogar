import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

/** Keep in sync with the inline script in index.html. */
export const THEME_STORAGE_KEY = "hogar-theme";

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
  document.documentElement.dataset["theme"] = resolve(readPreference());
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
