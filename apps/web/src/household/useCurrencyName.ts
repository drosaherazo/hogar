import { type CurrencyCode } from "@hogar/shared";
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
