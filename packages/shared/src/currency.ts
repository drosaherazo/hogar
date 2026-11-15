import { z } from "zod";
import type { ErrorCode } from "./errors";
import type { Locale } from "./locale";

/**
 * The currencies a household can use (ADR 0011), each with the decimals people actually use.
 * That starts from ISO 4217 but departs from it where everyday use differs: nobody pays in
 * Colombian or Argentine centavos, so COP and ARS are kept, split and shown in whole pesos.
 * Amounts are always whole numbers of the currency's minor unit (a cent, or a peso for COP).
 */
const DECIMALS = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  CHF: 2,
  MXN: 2,
  BRL: 2,
  PEN: 2,
  COP: 0,
  CLP: 0,
  ARS: 0,
} as const;

export type CurrencyCode = keyof typeof DECIMALS;
export const CURRENCY_CODES = Object.keys(DECIMALS) as CurrencyCode[];

export interface Currency {
  code: CurrencyCode;
  /** Digits after the decimal separator: how many minor units make a major one (2 → 100). */
  decimals: 0 | 2;
}

/** A listed currency code, exactly as written in ISO 4217 ("COP"). */
export const currencyCodeSchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], {
  error: "money.currency.invalid" satisfies ErrorCode,
});

export function currency(code: CurrencyCode): Currency {
  return { code, decimals: DECIMALS[code] };
}

/**
 * Whole units, digits only, with an optional decimal part of one or two digits after a comma or a
 * point. Either separator works in both languages; thousands separators don't, because "1.200"
 * would mean different things to different people. Up to nine whole digits, which is already
 * beyond any amount the API accepts.
 */
const WITH_DECIMALS = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

/**
 * Whole units only. With no decimal part possible, a point or a comma can only group thousands
 * ("85.000" is 85000), so both are accepted, but only between groups of three digits: "12,50" is
 * refused instead of silently becoming 1250. Up to twelve digits, safely inside a JS number.
 */
const WITHOUT_DECIMALS = /^(?:\d{1,12}|\d{1,3}(?:[.,]\d{3}){1,3})$/;

/**
 * Reads an amount typed by a person as whole minor units of `currency`, or `null` when it isn't
 * one. Built from the digit strings, never through floating point, so "0.29" is 29 cents and not
 * 28.999…. Range checks are the schema's job.
 */
export function parseAmount(text: string, currency: Currency): number | null {
  const trimmed = text.trim();
  if (currency.decimals === 0) {
    return WITHOUT_DECIMALS.test(trimmed) ? Number(trimmed.replace(/[.,]/g, "")) : null;
  }
  const match = WITH_DECIMALS.exec(trimmed);
  if (!match) return null;
  const [, whole = "0", decimals = ""] = match;
  return Number(whole) * 10 ** currency.decimals + Number(decimals.padEnd(currency.decimals, "0"));
}

/**
 * Minor units as a person would type them in an amount field ("7,70" in Spanish, "7.70" in
 * English, "85000" for pesos): no currency symbol and no thousands separators, so `parseAmount`
 * reads it back exactly. Used to prefill forms.
 */
export function amountInputValue(units: number, currency: Currency, language: Locale): string {
  if (currency.decimals === 0) return String(units);
  const scale = 10 ** currency.decimals;
  const decimals = String(units % scale).padStart(currency.decimals, "0");
  return `${Math.trunc(units / scale)}${language === "es" ? "," : "."}${decimals}`;
}

const EURO_REGIONS = [
  // Euro area members (Bulgaria joined in 2026)…
  ["AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL"],
  ["PT", "SI", "SK"],
  // …and places that use the euro without being members.
  ["AD", "MC", "ME", "SM", "VA", "XK"],
].flat();

/** Region (ISO 3166 alpha-2) → the listed currency people there spend. */
const CURRENCY_BY_REGION: Readonly<Record<string, CurrencyCode>> = {
  ...Object.fromEntries(EURO_REGIONS.map((region) => [region, "EUR"])),
  US: "USD",
  EC: "USD",
  SV: "USD",
  PR: "USD",
  GB: "GBP",
  CH: "CHF",
  LI: "CHF",
  MX: "MXN",
  BR: "BRL",
  PE: "PEN",
  CO: "COP",
  CL: "CLP",
  AR: "ARS",
};

/**
 * The currency to suggest when someone creates a household: the first device language whose
 * region is known (`["es", "es-CO"]` → COP), or euros when none is.
 */
export function suggestCurrency(languages: readonly string[]): CurrencyCode {
  for (const language of languages) {
    const region = /^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})\b/i.exec(language)?.[1]?.toUpperCase();
    const code = region ? CURRENCY_BY_REGION[region] : undefined;
    if (code) return code;
  }
  return "EUR";
}
