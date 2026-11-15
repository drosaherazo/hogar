import { regionsUsing, type CurrencyCode } from "@hogar/shared";

/** One option in a currency search: its name in the active language and, when that's why it matched, a country. */
export interface CurrencyResult {
  code: CurrencyCode;
  name: string;
  /** The country whose name matched, so the person sees why a currency they didn't name appears. */
  country?: string;
}

interface Searchable {
  code: CurrencyCode;
  name: string;
  /** Name and code, folded for matching. */
  folded: string;
  countries: { name: string; folded: string }[];
}

/**
 * Builds a search over `codes` in `language` (ADR 0014): a typed text matches a currency when it is
 * part of its name, its ISO code or the name of a country that uses it, ignoring case and accents
 * ("alemania" finds the euro through "Alemania"). Names come from `Intl.DisplayNames`, so nothing is
 * hand-written; results keep the language's alphabetical order.
 */
export function createCurrencySearch(codes: readonly CurrencyCode[], language: string) {
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(language);
  const currencyNames = new Intl.DisplayNames(language, { type: "currency" });
  const regionNames = new Intl.DisplayNames(language, { type: "region" });

  const searchable: Searchable[] = codes
    .map((code) => {
      const name = currencyNames.of(code) ?? code;
      const countries = regionsUsing(code)
        .map((region) => regionNames.of(region))
        .filter((country): country is string => country !== undefined)
        .map((country) => ({ name: country, folded: fold(country) }));
      return { code, name, folded: fold(`${name} ${code}`), countries };
    })
    .sort((a, b) => a.name.localeCompare(b.name, language));

  return (query: string): CurrencyResult[] => {
    const wanted = fold(query.trim());
    const results: CurrencyResult[] = [];
    for (const { code, name, folded, countries } of searchable) {
      if (folded.includes(wanted)) {
        results.push({ code, name });
        continue;
      }
      const country = countries.find((candidate) => candidate.folded.includes(wanted));
      if (country) results.push({ code, name, country: country.name });
    }
    return results;
  };
}
