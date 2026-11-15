import { isRetired, OFFERED_CURRENCY_CODES, type CurrencyCode } from "@hogar/shared";
import { useLocale } from "@hogar/ui";
import { useMemo } from "react";

/** A currency's name in the active language ("Colombian peso" / "peso colombiano"), from `Intl.DisplayNames`. */
export function useCurrencyName() {
  const locale = useLocale();
  return useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: "currency" });
    return (code: CurrencyCode) => names.of(code) ?? code;
  }, [locale]);
}

/**
 * The currencies someone can choose (ADR 0014: every one in force somewhere, never a retired one),
 * named in the active language and sorted the way that language sorts, so nobody needs to know ISO
 * codes. `current` is the household's own currency: kept in the list even if it has since been
 * retired, so a settings field can still show it.
 */
export function useCurrencyOptions(current?: CurrencyCode) {
  const locale = useLocale();
  const nameOf = useCurrencyName();
  return useMemo(() => {
    const codes = current && isRetired(current) ? [...OFFERED_CURRENCY_CODES, current] : OFFERED_CURRENCY_CODES;
    return codes
      .map((code) => ({ value: code, label: nameOf(code) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [current, locale, nameOf]);
}
