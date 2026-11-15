import { z } from "zod";
import type { ErrorCode } from "./errors";
import { CURRENCIES, CURRENCY_BY_REGION } from "./generated/currencies";
import type { Locale } from "./locale";

/**
 * The currencies a household can use (ADRs 0011, 0014): every currency in force and legal tender
 * somewhere, generated from Unicode CLDR with the decimals people actually use (CLDR's cash
 * decimals, so Colombian pesos and yen have none; Kuwaiti dinars have three). Amounts are always
 * whole numbers of the currency's minor unit (a cent, a fils, or a peso for COP).
 */
export type CurrencyCode = keyof typeof CURRENCIES;
/** Every listed code, retired ones included: what stored households and money records may hold. */
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** A currency no longer in force anywhere: households that have it keep it, nobody can pick it. */
export function isRetired(code: CurrencyCode): boolean {
  return "retired" in CURRENCIES[code];
}

/** The codes offered when creating a household or changing its currency. */
export const OFFERED_CURRENCY_CODES = CURRENCY_CODES.filter((code) => !isRetired(code));

export interface Currency {
  code: CurrencyCode;
  /** Digits after the decimal separator: how many minor units make a major one (2 → 100). */
  decimals: 0 | 2 | 3;
}

const invalid = { error: "money.currency.invalid" satisfies ErrorCode };

/** A listed currency code, exactly as written in ISO 4217 ("COP"), retired ones included. */
export const currencyCodeSchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], invalid);

/** A currency someone can choose now: listed and not retired. */
export const offeredCurrencyCodeSchema = z.enum(OFFERED_CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], invalid);

export function currency(code: CurrencyCode): Currency {
  return { code, decimals: CURRENCIES[code].decimals };
}

/**
 * Whole units, digits only, with an optional decimal part of up to the currency's decimals after a
 * comma or a point. Either separator works in both languages; thousands separators don't, because
 * "1.200" would mean different things to different people. Up to nine whole digits, which is
 * already beyond any amount the API accepts.
 */
const WITH_DECIMALS = { 2: /^(\d{1,9})(?:[.,](\d{1,2}))?$/, 3: /^(\d{1,9})(?:[.,](\d{1,3}))?$/ };

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
  const match = WITH_DECIMALS[currency.decimals].exec(trimmed);
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

/**
 * The currency to suggest when someone creates a household: the first device language whose
 * region is known (`["es", "es-CO"]` → COP), or euros when none is.
 */
export function suggestCurrency(languages: readonly string[]): CurrencyCode {
  for (const language of languages) {
    const region = /^[a-z]{2,3}(?:-[a-z]{4})?-([a-z]{2})\b/i.exec(language)?.[1]?.toUpperCase();
    const code = region ? (CURRENCY_BY_REGION as Readonly<Record<string, CurrencyCode>>)[region] : undefined;
    if (code) return code;
  }
  return "EUR";
}

const REGIONS_BY_CURRENCY = new Map<CurrencyCode, string[]>();
for (const [region, code] of Object.entries(CURRENCY_BY_REGION) as [string, CurrencyCode][]) {
  REGIONS_BY_CURRENCY.set(code, [...(REGIONS_BY_CURRENCY.get(code) ?? []), region]);
}

/**
 * The regions (ISO 3166 alpha-2) whose currency this is: the region → currency map reversed, so a
 * region with several currencies counts only for the one suggested there. Lets people find a
 * currency by country.
 */
export function regionsUsing(code: CurrencyCode): readonly string[] {
  return REGIONS_BY_CURRENCY.get(code) ?? [];
}
