import { isRetired, OFFERED_CURRENCY_CODES, type CurrencyCode } from "@hogar/shared";
import { useLocale, type ComboboxItem } from "@hogar/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createCurrencySearch } from "./currencySearch";

/** A currency's name in the active language ("Colombian peso" / "peso colombiano"), from `Intl.DisplayNames`. */
export function useCurrencyName() {
  const locale = useLocale();
  return useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: "currency" });
    return (code: CurrencyCode) => names.of(code) ?? code;
  }, [locale]);
}

/**
 * The search behind the currency `Combobox` (ADR 0014): the currencies someone can choose, never a
 * retired one, found by name, code or country in the active language. `current` is the
 * household's own currency: kept in the list even if it has since been retired, so the settings
 * field can still show it.
 */
export function useCurrencySearch(current?: CurrencyCode) {
  const locale = useLocale();
  const { t } = useTranslation("household");
  return useMemo(() => {
    const codes = current && isRetired(current) ? [...OFFERED_CURRENCY_CODES, current] : OFFERED_CURRENCY_CODES;
    const search = createCurrencySearch(codes, locale);
    return (query: string): ComboboxItem[] =>
      search(query).map(({ code, name, country }) => ({
        id: code,
        label: name,
        tag: code,
        detail: country && t("currencyPicker.usedIn", { country }),
      }));
  }, [current, locale, t]);
}
