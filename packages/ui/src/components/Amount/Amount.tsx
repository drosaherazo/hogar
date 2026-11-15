import clsx from "clsx";
import { useLocale, type Locale } from "../../locale/LocaleProvider";
import styles from "./Amount.module.css";

/**
 * The currency an amount is in: its ISO code and the decimals people actually use with it, which
 * the app decides (Colombian pesos have none). `ui` doesn't know the app's currency list, so the
 * caller passes both.
 */
export interface AmountCurrency {
  code: string;
  decimals: number;
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats a whole number of minor units (cents, or pesos for a currency without decimals) for a
 * locale ("€42.80" / "42,80 €" / "10.000 COP"). Money is kept in minor units everywhere and only
 * turned into a figure here, for display. Use it to put amounts inside translated sentences; use
 * `Amount` for standalone figures.
 */
export function formatAmount(units: number, currency: AmountCurrency, locale: Locale): string {
  const key = `${locale}|${currency.code}|${currency.decimals}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(units / 10 ** currency.decimals);
}

export interface AmountProps {
  /**
   * Whole minor units of `currency`. Pass the size of the amount: whether it's owed or owing is
   * said in words by the surrounding text, never by a sign alone.
   */
  units: number;
  currency: AmountCurrency;
  className?: string | undefined;
}

/** An amount of money in the active locale, with tabular numbers so figures line up in lists. */
export function Amount({ units, currency, className }: AmountProps) {
  const locale = useLocale();
  return <span className={clsx(styles.amount, className)}>{formatAmount(units, currency, locale)}</span>;
}
