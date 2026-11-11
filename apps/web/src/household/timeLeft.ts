const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * "in 5 hours" / "dentro de 5 horas", or minutes in the last hour. Built with
 * `Intl.RelativeTimeFormat`, so each language keeps its own grammar.
 */
export function formatTimeLeft(expiresAt: string, locale: string, now: Date = new Date()): string {
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (remaining >= HOUR_MS) return format.format(Math.round(remaining / HOUR_MS), "hour");
  return format.format(Math.max(1, Math.ceil(remaining / MINUTE_MS)), "minute");
}
