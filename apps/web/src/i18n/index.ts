import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@hogar/shared";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next, useTranslation } from "react-i18next";
import { NAMESPACES, resources } from "./resources";

export const LANGUAGE_STORAGE_KEY = "hogar-language";

/** Language names are always shown in their own language, so people can find theirs. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };

export function createI18n(options: { lng?: Locale } = {}) {
  const instance = i18n.createInstance();
  instance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      ns: NAMESPACES,
      defaultNS: "common",
      supportedLngs: [...LOCALES],
      fallbackLng: DEFAULT_LOCALE,
      nonExplicitSupportedLngs: true,
      load: "languageOnly",
      ...(options.lng ? { lng: options.lng } : {}),
      detection: {
        // A stored choice wins; otherwise the browser's languages; otherwise English.
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: [],
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });

  instance.on("languageChanged", (lng) => {
    document.documentElement.lang = currentLocale(lng);
  });
  document.documentElement.lang = currentLocale(instance.resolvedLanguage);
  return instance;
}

export function currentLocale(language: string | undefined): Locale {
  const base = language?.split("-")[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

/** Whether the person picked a language themselves (as opposed to the browser default). */
export function hasStoredLanguage(): boolean {
  try {
    return isLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return false;
  }
}

/** Active locale plus a setter that remembers the choice. */
export function useLocalePreference() {
  const { i18n: instance } = useTranslation();
  const locale = currentLocale(instance.resolvedLanguage);
  const setLocale = (next: Locale, { remember = true } = {}) => {
    if (remember) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        // Private mode: the choice lasts for this page only.
      }
    }
    void instance.changeLanguage(next);
  };
  return { locale, setLocale };
}
