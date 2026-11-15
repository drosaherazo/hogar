/**
 * Turns CLDR's `supplemental.currencyData` into the currency table a household can choose from
 * (ADR 0014). Pure, so the rules are unit-tested; `generate-currencies.mjs` does the reading and
 * writing.
 */

/**
 * Where everyday use still differs from CLDR, with the reason. Adding one is a reviewed change to
 * this list, never an edit of the generated table.
 */
export const DECIMAL_EXCEPTIONS = {
  // Centavos are unused under Argentina's inflation; with two decimals the single maximum would
  // also cap one amount far too low.
  ARS: 0,
};

/** The decimals the app's parsing, splitting and formatting handle. */
const SUPPORTED_DECIMALS = new Set([0, 2, 3]);

/** A region entry in force (no end date) and legal tender. */
const inForce = (entry) => entry._to === undefined && entry._tender !== "false";

/** Each region's currencies in CLDR's order, as `[code, entry]` pairs. */
const entriesOf = (list) => list.map((item) => Object.entries(item)[0]);

function decimalsOf(code, fractions) {
  if (code in DECIMAL_EXCEPTIONS) return DECIMAL_EXCEPTIONS[code];
  const fraction = fractions[code] ?? fractions.DEFAULT;
  const decimals = Number(fraction._cashDigits ?? fraction._digits);
  if (!SUPPORTED_DECIMALS.has(decimals)) {
    throw new Error(`${code} has ${decimals} decimals in CLDR; add a documented exception or support it first.`);
  }
  return decimals;
}

const sortedByKey = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));

/**
 * @param currencyData CLDR's `supplemental.currencyData` (`fractions` and `region`).
 * @param previous The table generated last time: a code in it that CLDR no longer lists is kept,
 *   as retired, so no household's currency ever disappears.
 * @returns `currencies` (code → decimals, plus `retired`) and `regions` (region → the currency to
 *   suggest there), both sorted by key so diffs stay small.
 */
export function buildCurrencyTable(currencyData, previous) {
  const { fractions, region } = currencyData;
  const currencies = {};
  const regions = {};
  for (const [regionCode, list] of Object.entries(region)) {
    const current = entriesOf(list).filter(([, entry]) => inForce(entry));
    for (const [code] of current) currencies[code] ??= { decimals: decimalsOf(code, fractions) };
    if (current.length > 0) regions[regionCode] = current[0][0];
  }
  for (const [code, { decimals }] of Object.entries(previous)) {
    const now = currencies[code];
    if (now === undefined) currencies[code] = { decimals, retired: true };
    else if (now.decimals !== decimals) {
      // Households store whole minor units: new decimals would silently rescale every amount.
      throw new Error(
        `${code} had ${decimals} decimals and CLDR now gives ${now.decimals}; keep them with a documented exception.`,
      );
    }
  }
  return { currencies: sortedByKey(currencies), regions: sortedByKey(regions) };
}
