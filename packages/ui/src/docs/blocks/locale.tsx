import { useEffect, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../../locale/LocaleProvider";
import { useDocsGlobal } from "./globals";

/** A value written once per supported locale. */
export type Localized<T = string> = Record<Locale, T>;

/** Locale selected in the Storybook toolbar, for MDX docs pages. Falls back to `en`. */
export function useDocsLocale(): Locale {
  const value = useDocsGlobal("locale");
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return locale;
}

/** Renders its content only when the toolbar locale matches. Wrap each language's prose in MDX. */
export function Lang({ locale, children }: { locale: Locale; children: ReactNode }) {
  return useDocsLocale() === locale ? <>{children}</> : null;
}

/** Picks the value for the toolbar locale. */
export function useLocalized<T>(value: Localized<T>): T {
  return value[useDocsLocale()];
}
