import { badRequest } from "../httpError";

/** A calendar day (`YYYY-MM-DD`) as the `Date` Postgres stores for a `DATE` column: UTC midnight. */
export function fromCalendarDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The calendar day of a `DATE` column, as `YYYY-MM-DD`. */
export function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Refuses days that haven't happened yet. The limit is the server's UTC date plus one day:
 * somewhere ahead of UTC it may already be tomorrow (a Spanish entry just after midnight), and
 * the web already stops people at their own local today.
 */
export function assertNotFuture(day: string, now: Date): void {
  const latest = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  if (fromCalendarDate(day).getTime() > latest) throw badRequest("money.date.future");
}
