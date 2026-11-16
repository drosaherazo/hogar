import { amountInputValue, currency, MAX_AMOUNT_UNITS, MIN_AMOUNT_UNITS, type Currency } from "@hogar/shared";
import { formatAmount, useFormattingLocale, useLocale } from "@hogar/ui";
import { useMemo } from "react";
import { useHousehold } from "../household/useHousehold";

/**
 * The currency the household's money is in (ADR 0011). Money only shows up inside a household,
 * which is loaded before any page that shows it; euros only stand in while it loads.
 */
export function useCurrency(): Currency {
  const code = useHousehold().data?.household?.currency ?? "EUR";
  return useMemo(() => currency(code), [code]);
}

/**
 * What amount fields need to speak the household's currency: the symbol for their label
 * ("Amount (€)", "Amount (COP)"), an example for their hint that the field reads back, the limits
 * for `errors:money.amount.invalid` (pass `limits` to any error translation), and the phone
 * keyboard to bring up: digits only when the currency has no decimals, a decimal key otherwise.
 */
export function useAmountField() {
  const language = useLocale();
  const locale = useFormattingLocale();
  const money = useMoney();
  const currency = useCurrency();
  return useMemo(() => {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency: currency.code }).formatToParts(0);
    // The symbol is how money is shown (formatting locale: "$" in es-CO); the example is how it's
    // typed, which parseAmount reads per language, so it uses the language. Pesos are written in
    // thousands, cents as a small purchase: both read like a real amount.
    const example = amountInputValue(currency.decimals === 0 ? 85_000 : 4280, currency, language);
    return {
      symbol: parts.find((part) => part.type === "currency")?.value ?? currency.code,
      example,
      limits: { min: money(MIN_AMOUNT_UNITS), max: money(MAX_AMOUNT_UNITS) },
      inputMode: currency.decimals === 0 ? ("numeric" as const) : ("decimal" as const),
    };
  }, [language, locale, money, currency]);
}

/** Whole-number percentage of shared costs, in the formatting locale ("75%" / "75 %"). */
export function usePercent() {
  const locale = useFormattingLocale();
  return useMemo(() => {
    const format = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    return (bps: number) => format.format(bps / 10000);
  }, [locale]);
}

/** Minor units in the household's currency, for sentences ("You owe {{amount}}"); standalone figures use `Money`. */
export function useMoney() {
  const locale = useFormattingLocale();
  const currency = useCurrency();
  return useMemo(() => (units: number) => formatAmount(units, currency, locale), [locale, currency]);
}

/** "Ana 75 % y Bruno 25 %": a list joined the way the active language joins lists. */
export function useList() {
  const locale = useFormattingLocale();
  return useMemo(() => {
    const format = new Intl.ListFormat(locale, { type: "conjunction" });
    return (items: readonly string[]) => format.format(items);
  }, [locale]);
}

/** A calendar day (`YYYY-MM-DD`) as a `Date`, at UTC midnight. */
const fromDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Calendar days in the formatting locale (the active language plus the device region). They are formatted in UTC, the zone they're stored in,
 * so a day never shifts to the one before or after on someone's device.
 */
export function useDates() {
  const locale = useFormattingLocale();
  return useMemo(() => {
    const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const medium = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    const month = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    const instant = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
    return {
      /** "26 Oct" / "26 oct" */
      short: (day: string) => short.format(fromDay(day)),
      /** "26 Oct 2026" / "26 oct 2026" */
      medium: (day: string) => medium.format(fromDay(day)),
      /** "October 2026" / "octubre de 2026" */
      month: (day: string) => month.format(fromDay(day)),
      /** A moment (ISO timestamp), as a date in the person's own time zone. */
      instant: (iso: string) => instant.format(new Date(iso)),
    };
  }, [locale]);
}

const AGO_UNITS = [
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
] as const;

/**
 * How long ago a moment was, in the person's words: "5 minutes ago", "yesterday", "hace 2 horas",
 * in the largest whole unit (under a minute reads as "this minute").
 */
export function formatAgo(at: number, now: number, locale: string): string {
  const elapsed = Math.max(0, now - at);
  const { unit, ms } = AGO_UNITS.find((candidate) => elapsed >= candidate.ms) ?? AGO_UNITS[2];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.floor(elapsed / ms), unit);
}

/** Today on the person's device, as `YYYY-MM-DD`: the default and the latest day for new records. */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
