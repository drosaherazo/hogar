import { z } from "zod";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const localeSchema = z.enum(LOCALES);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a supported locale from a language tag ("es-ES"), a Google `locale` claim
 * or an `Accept-Language` header ("es-ES,es;q=0.9,en;q=0.8"). Falls back to `en`.
 */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const candidates = input
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params.map((param) => /^q=([\d.]+)$/.exec(param.trim())?.[1]).find(Boolean);
      return { language: tag.toLowerCase().split("-")[0] ?? "", quality: quality ? Number(quality) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);
  return candidates.map((candidate) => candidate.language).find(isLocale) ?? DEFAULT_LOCALE;
}
