# 0014 · The currency list is generated from Unicode CLDR

- **Status:** accepted
- **Date:** 2026-11-15

## Context

ADR 0011 gave each household one currency from a hand-curated list of ten (EUR, USD, GBP, CHF, MXN, BRL, PEN, COP, CLP, ARS). It rejected "all ISO currencies" because we could not vouch for the decimals people actually use in ~180 of them. Group-expense apps such as Tricount and Splitwise offer around 150 currencies; ten shuts out most of the world for no domain reason.

Unicode CLDR, the data behind `Intl` in every browser, records for each currency its ISO decimals (`digits`) and, where everyday use differs, its cash decimals (`cashDigits`: COP, HUF and IDR have 2 and 0), plus which currencies are in force and legal tender in each region, with start and end dates.

## Decision

- **CLDR is the single source** for which currencies are listed, their decimals and the region → currency map. Nothing is picked by hand except documented exceptions.
- **Listed: every currency in force and legal tender in at least one region** (no end date, not `tender="false"`). That leaves out precious metals, funds, units of account, test codes and withdrawn currencies without a hand-kept exclusion list, and keeps shared ones (XOF, XAF, XCD, XPF). 153 currencies with CLDR 49.
- **Decimals: `cashDigits` when CLDR has it, otherwise `digits`.** Exceptions where everyday use still differs live in the generator, each with its reason: ARS, KHR, NGN, CDF, MWK and SSP with 0 (minor units nobody uses, which also raises their one-amount cap a hundredfold) and SEK, NOK and CZK with 2 (card and shelf prices like "29,90" are everyday use even though cash rounds to whole units). Currencies with 3 decimals (KWD, BHD, JOD, OMR, TND, LYD) are supported, so a currency has 0, 2 or 3 decimals.
- **Generated, not read at runtime:** `cldr-core` is a dev dependency of `packages/shared`; a `.mjs` script writes a static table that is committed with the CLDR version in its header. Updating is bumping `cldr-core`, running the script and reviewing the diff. Web and API never load CLDR itself.
- **A listed code is never removed.** When CLDR withdraws a currency, the generator marks it retired: households already using it keep working and their amounts display as before, but it is no longer offered when creating a household or changing its currency; if CLDR lists it again, it is offered again. A test fails if a code disappears from the table, and the generator refuses to change the decimals of a listed code, which would rescale stored amounts (an exception keeps them instead).
- **Suggestion from the device region uses CLDR's region → currency data.** Where a region has several currencies in force (Panama: PAB and USD), the first one CLDR lists is suggested; unknown regions still get EUR. Searching by a country finds every currency in force and legal tender there ("Panamá" → PAB and USD).
- **One maximum stays for every currency:** 1,000,000,000 minor units per amount, so schemas validate without knowing the currency. For very low-value currencies this caps one amount low (IRR, about US$1,000 at market rate); a larger expense can be split in two.

## Considered options

- **Ask `Intl` at runtime:** no table, but `Intl` only exposes ISO decimals (COP would get 2) and can differ between browsers, breaking "stored, split and displayed units match".
- **Hand-review all currencies:** what ADR 0011 said we could not vouch for; no public source to defend it.
- **A curated top 50:** shorter, but needs an invented criterion for who is left out.
- **A maximum per currency:** fairer to IRR, but every schema would need the household's currency to validate.
- **`BigInt` amounts:** removes the ceiling at the cost of a migration touching all money code, for an edge case.
- **Delete withdrawn currencies and convert households:** conversion stays out of scope (ADR 0011).

## Consequences

- ADR 0011's hand-curated list is superseded; its other decisions (one currency per household, fixed after the first money record, practical decimals, writes carrying the currency seen, formatting by language plus region, one maximum) stand.
- The constitution's rule II says the list is generated from CLDR.
- Choosing among 153 currencies needs a searchable `Combobox` (by name, ISO code or country) in `packages/ui`, built on `react-aria` (ADR 0013).
- Adding or fixing a currency means regenerating or adding a documented exception, never editing the table by hand.
