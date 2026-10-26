import { createContext, useContext, type ReactNode } from "react";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export interface LocaleProviderProps {
  locale: Locale;
  children: ReactNode;
}

/**
 * Provides the active locale to formatting components (money, dates).
 * `ui` holds no copy: translated strings always come in through props.
 */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Active locale; falls back to `en` outside a provider. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
