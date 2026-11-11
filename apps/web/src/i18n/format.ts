import { formatAmount, useLocale } from "@hogar/ui";
import { useMemo } from "react";

/** Whole-number percentage of shared costs, in the active language ("75%" / "75 %"). */
export function usePercent() {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    return (bps: number) => format.format(bps / 10000);
  }, [locale]);
}

/** Cents as euros for sentences ("You owe {{amount}}"); standalone figures use the `Amount` component. */
export function useMoney() {
  const locale = useLocale();
  return useMemo(() => (cents: number) => formatAmount(cents, locale), [locale]);
}

/** "Ana 75 % y Bruno 25 %": a list joined the way the active language joins lists. */
export function useList() {
  const locale = useLocale();
  return useMemo(() => {
    const format = new Intl.ListFormat(locale, { type: "conjunction" });
    return (items: readonly string[]) => format.format(items);
  }, [locale]);
}

/** A calendar day (`YYYY-MM-DD`) as a `Date`, at UTC midnight. */
const fromDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

/**
 * Calendar days in the active language. They are formatted in UTC, the zone they're stored in,
 * so a day never shifts to the one before or after on someone's device.
 */
export function useDates() {
  const locale = useLocale();
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

/** Today on the person's device, as `YYYY-MM-DD`: the default and the latest day for new records. */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
