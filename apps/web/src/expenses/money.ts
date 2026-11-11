/**
 * Euros and cents, digits only, with an optional decimal part of one or two digits after a comma
 * or a point. Either separator works in both languages; thousands separators don't, because
 * "1.200" would mean different things to different people. Up to nine digits of euros, which is
 * already far beyond any amount the API accepts.
 */
const AMOUNT = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

/**
 * Reads an amount typed by a person ("42,80", "42.80", "42") as whole cents, or `null` when it
 * isn't one. Built from the digit strings, never through floating point, so "0.29" is 29 cents
 * and not 28.999…. Range checks (at least €0.01, at most €100,000.00) are the schema's job.
 */
export function parseAmount(text: string): number | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) return null;
  const [, euros = "0", decimals = ""] = match;
  return Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
}
