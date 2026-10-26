import { DEFAULT_LOCALE, isLocale, type Locale } from "../../locale/LocaleProvider";
import type { Localized } from "./locale";

/** Locale selected in the toolbar, from a story's `globals`. */
export function storyLocale(globals: Record<string, unknown>): Locale {
  const value = globals["locale"];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Story copy for the toolbar locale. Stories pass already-translated text to components, like the app does. */
export function storyText<T>(globals: Record<string, unknown>, value: Localized<T>): T {
  return value[storyLocale(globals)];
}
