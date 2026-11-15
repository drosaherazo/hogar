# 0011 · One currency per household, in the units people actually use

- **Status:** accepted; its hand-curated list superseded by [0014](./0014-currency-list-from-cldr.md)
- **Date:** 2026-11-15

## Context

Until now every amount was EUR, hardcoded in the constitution, in `Amount` and in the copy ("Amount (€)"). That shuts out anyone outside the eurozone, such as a household in Colombia paying in pesos. Amounts are integers with no currency attached (`1250` meant €12.50), and the split, balance and debt-simplification logic works on those integers whatever they stand for.

## Decision

- **Each household has exactly one currency**, chosen from a curated list in `packages/shared`. Money in two currencies never mixes: there is no conversion and no exchange rate.
- **Amounts are integers in the currency's practical minor unit.** The list records, for each currency, the decimals people really use. It starts from ISO 4217 and departs from it where everyday use differs: COP (and other currencies where nobody uses cents in practice, such as ARS) has 0 decimals, so a Colombian household stores, splits and shows whole pesos. The leftover rule is unchanged: leftover units go to the first members.
- **Chosen at creation, fixed after the first money record.** The create form suggests a currency from the device region (`es-CO` → COP, unknown → EUR). An admin can change it only while the household has no expense or payment, deleted ones included. After that it is fixed, because changing it would silently reinterpret stored amounts.
- **Writes carry the currency the person saw.** An expense or payment states its currency code, and the API rejects it with `money.currency.mismatch` when it differs from the household's. That closes the race where the currency changes while a form is open.
- **Formatting uses the active language plus the device region** (`es` + `es-CO` → `es-CO`), so each person sees separators and symbols the way they write them: "$ 1.234.567" for a Colombian, "1.234.567 COP" for someone in Spain looking at the same household. Translations stay `en` and `es`.
- **Input follows the currency's decimals.** For a currency with no decimals, "." and "," are always thousands separators ("85.000" is 85000), and only between groups of three digits, so "12,50" is refused instead of silently becoming 1250 pesos. For a currency with two decimals, the existing rule stands: one separator followed by 1–2 digits, and no thousands separators.
- **One maximum for every currency:** 1,000,000,000 minor units per amount. It fits Postgres `Int`, so schemas validate without knowing the currency. Each listed currency is checked against it.

## Considered options

- **Keep EUR only:** simplest, but excludes most of the world for no domain reason.
- **Several currencies inside one household, with conversion:** needs exchange rates and a choice of whose rate counts, and breaks "splits always add up" across currencies. It is a rare need for a shared home and stays out of scope.
- **Strict ISO 4217 minor units:** COP in cents while showing whole pesos makes displayed shares stop adding up ($10,000 / 3 displayed as $3,333 three times).
- **All ISO currencies:** we could not vouch for the practical decimals of ~180 currencies.
- **Format with the currency's home region:** an American in a COP household would see a bare "$" and could read it as dollars.

## Consequences

- The constitution changes: rule II ("Currency is always EUR") is redefined and the out-of-scope item becomes "multiple currencies within a household" (MAJOR bump). Rule V clarifies that `Intl` formatting uses the active language plus the device region.
- `packages/ui` stays free of `shared`: `Amount` receives the currency (code and decimals) through props.
- Existing households are migrated to EUR, so nothing they see changes.
- Adding a currency means one entry in the list plus a test of its decimals, its parsing and its maximum.
- The rule depends only on a language and a region, so a future native client (still out of scope) can apply it with the platform's locale.
