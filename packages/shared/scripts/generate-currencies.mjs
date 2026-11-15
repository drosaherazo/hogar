/**
 * Regenerates `src/generated/currencies.ts` from the installed `cldr-core` (ADR 0014):
 *
 *   pnpm --filter @hogar/shared generate:currencies
 *
 * To update, bump `cldr-core`, run this and review the diff. The previous table is read back, so a
 * code CLDR withdraws stays as retired instead of disappearing.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { buildCurrencyTable } from "./currencyTable.mjs";

const require = createRequire(import.meta.url);
const { version } = require("cldr-core/package.json");
const { currencyData } = require("cldr-core/supplemental/currencyData.json").supplemental;

const target = new URL("../src/generated/currencies.ts", import.meta.url);

/** The last generated table, read from the file itself so nothing else needs to run first. */
function previousCurrencies() {
  if (!existsSync(target)) return {};
  const block = /export const CURRENCIES = \{([\s\S]*?)\n\} as const;/.exec(readFileSync(target, "utf8"))?.[1] ?? "";
  const previous = {};
  for (const [, code, decimals, retired] of block.matchAll(
    /^\s+([A-Z]{3}): \{ decimals: (\d)(, retired: true)? \},$/gm,
  )) {
    previous[code] = retired ? { decimals: Number(decimals), retired: true } : { decimals: Number(decimals) };
  }
  return previous;
}

const { currencies, regions } = buildCurrencyTable(currencyData, previousCurrencies());

const currencyLines = Object.entries(currencies).map(
  ([code, { decimals, retired }]) => `  ${code}: { decimals: ${decimals}${retired ? ", retired: true" : ""} },`,
);
const regionLines = Object.entries(regions).map(
  ([region, codes]) => `  ${region}: [${codes.map((code) => `"${code}"`).join(", ")}],`,
);

writeFileSync(
  target,
  `// Generated from Unicode CLDR ${version} (cldr-core) by scripts/generate-currencies.mjs. Do not edit:
// run \`pnpm --filter @hogar/shared generate:currencies\` and review the diff (ADR 0014).

/** The CLDR release this table comes from. */
export const CLDR_VERSION = "${version}";

/**
 * Every currency a household can have, with the decimals people use (CLDR's cash decimals, else
 * its ISO decimals, plus the exceptions in scripts/currencyTable.mjs). \`retired\` ones are no
 * longer in force anywhere: kept for households that have them, never offered.
 */
export const CURRENCIES = {
${currencyLines.join("\n")}
} as const;

/**
 * Region (ISO 3166 alpha-2) → every currency in force and legal tender there, in CLDR's order.
 * The first is the one suggested there; all of them are found by searching the region's name.
 */
export const CURRENCIES_BY_REGION = {
${regionLines.join("\n")}
} as const;
`,
);

console.log(`Wrote ${currencyLines.length} currencies and ${regionLines.length} regions from CLDR ${version}.`);
