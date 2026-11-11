import clsx from "clsx";
import { useLocale, type Locale } from "../../locale/LocaleProvider";
import styles from "./Amount.module.css";

const formatters = new Map<Locale, Intl.NumberFormat>();

/**
 * Formats a whole number of euro cents for a locale ("€42.80" / "42,80 €"). Money is kept in
 * cents everywhere and only turned into euros here, for display. Use it to put amounts inside
 * translated sentences; use `Amount` for standalone figures.
 */
export function formatAmount(cents: number, locale: Locale): string {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
    formatters.set(locale, formatter);
  }
  return formatter.format(cents / 100);
}

export interface AmountProps {
  /**
   * Whole euro cents. Pass the size of the amount: whether it's owed or owing is said in words
   * by the surrounding text, never by a sign alone.
   */
  cents: number;
  className?: string;
}

/** A euro amount in the active locale, with tabular numbers so figures line up in lists. */
export function Amount({ cents, className }: AmountProps) {
  const locale = useLocale();
  return <span className={clsx(styles.amount, className)}>{formatAmount(cents, locale)}</span>;
}
