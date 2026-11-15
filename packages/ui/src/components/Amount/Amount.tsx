import clsx from "clsx";
import { Fragment } from "react";
import { useFormattingLocale } from "../../locale/LocaleProvider";
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
 * formatting locale, a BCP 47 tag ("€42.80" in `en`, "42,80 €" in `es`, "$ 10.000" pesos in `es-CO`). Money is kept in minor units everywhere and only
 * turned into a figure here, for display. Use it to put amounts inside translated sentences; use
 * `Amount` for standalone figures.
 */
export function formatAmount(units: number, currency: AmountCurrency, locale: string): string {
  return formatterFor(currency, locale).format(units / 10 ** currency.decimals);
}

function formatterFor(currency: AmountCurrency, locale: string): Intl.NumberFormat {
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
  return formatter;
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

/**
 * An amount of money in the active formatting locale, with tabular numbers so figures line up in
 * lists. It never wraps; a big standalone figure that sets `white-space: normal` may break only
 * after a digit group or the space by the currency ("1.284." / "000 COP"), never inside a group,
 * so a broken line can't be misread as another number.
 */
export function Amount({ units, currency, className }: AmountProps) {
  const locale = useFormattingLocale();
  const parts = formatterFor(currency, locale).formatToParts(units / 10 ** currency.decimals);
  return (
    <span className={clsx(styles.amount, className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part.value}
          {(part.type === "group" || part.type === "literal") && <wbr />}
        </Fragment>
      ))}
    </span>
  );
}
