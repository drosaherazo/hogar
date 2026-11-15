import { CURRENCY_CODES, type CurrencyCode } from "@hogar/shared";
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
 * The listed currencies as select options, named in the active language and sorted the way that
 * language sorts, so nobody needs to know ISO codes.
 */
export function useCurrencyOptions() {
  const locale = useLocale();
  const nameOf = useCurrencyName();
  return useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({ value: code, label: nameOf(code) })).sort((a, b) =>
        a.label.localeCompare(b.label, locale),
      ),
    [locale, nameOf],
  );
}
