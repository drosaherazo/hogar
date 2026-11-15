import { createContext, useContext, useMemo, type ReactNode } from "react";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

interface LocaleContextValue {
  locale: Locale;
  formattingLocale: string;
}

const LocaleContext = createContext<LocaleContextValue>({ locale: DEFAULT_LOCALE, formattingLocale: DEFAULT_LOCALE });

export interface LocaleProviderProps {
  /** The language the interface speaks. */
  locale: Locale;
  /**
   * The BCP 47 tag money, dates and numbers are formatted with: the language plus the device
   * region when they match ("es-CO"), so separators and symbols look the way each person writes
   * them. Defaults to `locale`.
   */
  formattingLocale?: string | undefined;
  children: ReactNode;
}

/**
 * Provides the active language and formatting locale to formatting components (money, dates).
 * `ui` holds no copy: translated strings always come in through props.
 */
export function LocaleProvider({ locale, formattingLocale, children }: LocaleProviderProps) {
  const value = useMemo(() => ({ locale, formattingLocale: formattingLocale ?? locale }), [locale, formattingLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Active language; falls back to `en` outside a provider. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** The tag to pass to `Intl` ("es-CO"); falls back to `en` outside a provider. */
export function useFormattingLocale(): string {
  return useContext(LocaleContext).formattingLocale;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
