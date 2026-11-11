# Research: Expenses with splits, balances and settling up

All Technical Context items were resolvable from the spec, the constitution and the households code; no open clarifications remain. Each decision lists what was chosen, why, and what was rejected.

A design review on 2026-11-11 (a decision-by-decision interview) confirmed R1–R16 and the spec's defaults (no future dates, the €100,000.00 limit, two screens, the vocabulary in `contracts/ui.md`). It made R3's rule explicit and added R17: deleting leaves a trace.

## R1 · Expenses and payments refer to users, not memberships

- **Decision:** `Expense.paidById`, `ExpenseShare.userId`, `Settlement.fromUserId` / `toUserId` and the `createdById` / `editedById` columns all reference `User`, and every expense or settlement row carries its `householdId`. A **former member** is a user who appears in a household's expenses or settlements but has no current `Membership` in it. It is derived, never stored.
- **Rationale:** Leaving and removal delete the `Membership` row (households feature), and `Membership.userId` is unique, which is how the constitution enforces one household per user. Pointing at users keeps the history intact when someone leaves (FR-027). Rejoining reconnects their earlier records automatically, because it is the same user (FR-029). The membership model and its invariants stay untouched.
- **Alternatives rejected:** Soft-deleting memberships (`leftAt`) would need a partial unique index instead of the plain unique `Membership.userId` the constitution names, and would make every households query filter on it. A separate persistent "person in household" table is a new layer for the same result.

## R2 · One cents splitter for every split method

- **Decision:** `packages/shared/src/split.ts` gains `splitAmount(amountCents: number, weights: readonly number[]): number[]`. Each share is `floor(amount × w / Σw)` in integer math, and leftover cents go one each to the first entries **with a weight above 0**, in the order given. That order is the household's member order (join date, then id). It is the cents version of `weightsToBasisPoints` (households R6) and uses the same rule.
  - **Default split (`WEIGHTS`):** current members' weights, in member order. Members with weight 0 get 0 and are not stored as shares.
  - **Equally (`EQUAL`):** weight 1 for each chosen person, in member order. Every chosen person is stored, even with €0.00 (spec edge case: €0.02 among three).
  - **Exact amounts (`EXACT`):** no splitting; the amounts must add up to the total (`expense.split.mismatch`). People given €0.00 are not stored (they don't share the expense).
- **Rationale:** Principle II asks for exact cents with deterministic leftovers to the first members. A single function covers all three methods and the edit rescaling in R3, and the web uses it for the live preview, so the form shows exactly what the API will save. The products stay below 10⁷ × 10⁷ = 10¹⁴ < 2⁵³, so JavaScript integers are exact.
- **Alternatives rejected:** Going through basis points first (two roundings, and a different result for some amounts). Largest-remainder allocation (doesn't match the constitution's "first members" rule).

## R3 · Shares are snapshots; editing rescales them

- **Decision:** Shares are computed once, when an expense is saved, and stored (FR-009). On edit:
  - If the expense used the default split, still uses it, **and the amount is unchanged**, its stored shares are kept as they are.
  - If the expense used the default split and **the amount changes**, the new shares are `splitAmount(newAmount, oldShares)`: the same people in the same proportions.
  - If the person switches to the default split from another method, the current weights are used.
  - `EQUAL` and `EXACT` edits send their people or amounts again, like a new expense. Former members already in the expense may stay in it (R11).
- **The rule behind it (design review):** an expense's shares only change when someone edits that expense, and the form shows the new shares before saving (FR-009). When editing a default-split expense, the option reads "The household's split when it was added (Ana 75 %, Bruno 25 %)", using the proportions of its stored shares, not today's weights.
- **Rationale:** "Later changes to weights or members must not change existing expenses" (FR-009) should also hold when someone fixes a typo in the amount. Rescaling the saved shares keeps the agreement that applied when the money was spent, and keeps former members in it (FR-028). **The spec was updated** to say so: the edge case on editing default-split expenses now describes rescaling instead of "recalculated with the current weights".
- **Alternatives rejected:** Recomputing with today's weights (an old expense silently changes proportion, and former members drop out of it). Forbidding amount edits on default-split expenses (unfriendly for typos).

## R4 · Balances are computed on read

- **Decision:** `GET /api/household/balances` runs four grouped sums for the caller's household: expense amounts by payer, shares by person, settlements by payer, settlements by receiver. A pure function, `netBalances({ paid, owed, sent, received })` in `packages/shared/src/balances.ts`, turns them into `balance = paid − owed + sent − received` per user. Positive means owed money, negative means owes. Nothing about balances is stored.
- **Rationale:** Principle II: "balances are never stored, they are computed from `ExpenseShare` and `Settlement`". Grouped sums keep the query count constant whatever the history length. The arithmetic lives in `shared`, where it is unit-tested, and the sum of all balances is zero by construction (every cent paid is a cent owed by someone).
- **Alternatives rejected:** A stored running balance per member (drift risk, and the constitution forbids it). Loading every expense and share and folding in JavaScript (fine for tests, wasteful for long histories).

## R5 · Suggested payments

- **Decision:** `suggestSettlements(balances)` in `packages/shared/src/balances.ts` uses greedy matching. Repeatedly, the person who owes the most pays the person owed the most `min(|debt|, credit)`. Ties are broken by the order given: current members in member order, then former members by name and id. Everyone sees the same list.
- **Rationale:** Each step settles at least one person, so there are at most `n − 1` payments for `n` people with a non-zero balance (FR-015, SC-004). Debtors only pay and creditors only receive. The spec's example (Ana → Bruno → Carla collapses to one payment from Carla to Ana) falls out naturally.
- **Alternatives rejected:** An exact minimum number of payments (NP-hard in general, and the spec's assumption already defines "fewest" as the `n − 1` bound). Suggesting one payment per pair of people who share expenses (more payments, and it doesn't simplify).

## R6 · Concurrency: version numbers and the household lock

- **Decision:** `Expense` and `Settlement` have a `version` (starting at 1). Edits send the version they started from and run `updateMany WHERE id AND householdId AND version`. If nothing was updated, the record either changed (409 `expense.changed` / `settlement.changed`) or is gone (404). Deletes pass `?version=` and are guarded the same way (FR-024). Writes that check who is a current member (payer, people sharing) take the existing household row lock (`lockHousehold`, `SELECT … FOR UPDATE`). Leave and remove already take that lock, so "Carla leaves while Ana adds an expense with her" is serialized.
- **Rationale:** Optimistic locking matches the spec's "refused with an explanation, then see the latest version" and needs no long-held locks. Reusing the households lock keeps one locking pattern.
- **Alternatives rejected:** Last write wins (FR-024 forbids it). Timestamps as versions (millisecond collisions, clock coupling).

## R7 · Dates

- **Decision:** Expense and settlement dates are calendar days: Postgres `DATE` (`@db.Date`), `YYYY-MM-DD` in JSON. The web date field defaults to the device's local today and sets it as `max`. The API refuses dates later than **the server's UTC date plus one day** (`money.date.future`), which tolerates time zones ahead of UTC without letting real future dates through.
- **Rationale:** The spec says dates are days without a time. A strict UTC "today" would refuse a Spanish user's entry made just after midnight local time. The native date input gives an accessible picker on mobile and desktop. It follows the browser's locale rather than the app's; that is acceptable because the value and every displayed date (formatted with `Intl` in the app's locale) stay consistent.
- **Alternatives rejected:** Timestamps (time zones change the day). Sending the client's time zone to validate exactly (more surface for a one-day edge).

## R8 · Money input and display

- **Decision:** Integer cents end to end; the API never sees decimals. Two pieces of code handle the text in between:
  - **Input:** `parseAmount(text)` in `apps/web/src/expenses/money.ts` accepts digits with an optional decimal part of one or two digits, separated by `,` or `.` (either works in both languages; thousands separators are refused). It builds cents from the two digit strings without floating point.
  - **Display:** a new `Amount` component in `packages/ui` (tabular figures) and its `formatAmount(cents, locale)` helper use `Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })` with the active locale from `LocaleProvider`. The web uses `formatAmount` to interpolate amounts into translated sentences ("You owe Ana {{amount}}").
- **Rationale:** Principle II (integer cents, formatted only when displayed) and principle V (money through `Intl` with the active locale). The helper lives in `ui` because formatting components are exactly what `LocaleProvider` exists for, and `ui` must not import `shared`. Dividing by 100 happens only inside `Intl` formatting, for display.
- **Alternatives rejected:** `parseFloat(text) * 100` (float errors such as `0.29 * 100 = 28.999…`). i18next's built-in currency formatter (it would need floats in translation calls and duplicate the `ui` formatting).

## R9 · History: one feed of expenses and payments

- **Decision:** `GET /api/household/activity?cursor=&limit=` returns expenses and settlements merged, newest first, ordered by `(date desc, createdAt desc, id desc)`. Each page takes `limit + 1` rows from each table with the same keyset condition, merges them, returns `limit` items (default 30), and an opaque `nextCursor` (base64 of the last item's `date|createdAt|id`). Each expense item carries the viewer's own part, computed by `viewerPart(expense, viewerId)` in `shared`: `owes` (their share when someone else paid), `lent` (amount minus their share when they paid) or `none`.
- **Rationale:** FR-003 and FR-021 put payments "alongside expenses, in date order". Keyset pagination stays fast and stable while people add records, and two small indexed queries per page avoid a `UNION` in raw SQL.
- **Alternatives rejected:** Offset pagination (duplicates or skipped rows when records are added). A single "ledger entries" table (merges two models the constitution names separately). Loading the whole history (unbounded).

## R10 · API shape and permissions

- **Decision:** Every endpoint stays under the singular, caller-resolved `/api/household` (households R10). There are ten endpoints: `activity`, `balances`, and `GET`/`POST`/`PUT`/`DELETE` on `expenses` and on `settlements`. Reads need any membership; writes need ADMIN or MEMBER through a new shared `canEditContent(role)` and a `requireEditor` middleware (403 `household.forbidden`). Expense and settlement ids are looked up scoped to the caller's household (404 otherwise), and every person id in a body must be a current member, or, where allowed, a person from the household's history (R11).
- **Rationale:** Principle III: no household id ever comes from the client, and other households' records stay invisible. `canEditContent` names the constitution's "MEMBER: create and edit content" once, for both the API and the web, which uses it to hide buttons.
- **Alternatives rejected:** `/api/households/:id/expenses` (the client would supply a household id that then has to be checked everywhere). Separate payer-only or creator-only edit rights (the clarification chose "any MEMBER or ADMIN").

## R11 · Former members

- **Decision:** Former members appear in responses as a person reference with `former: true`. Names and avatars come from `User`, so they stay readable. Where they are allowed:
  - **Balances:** counted until their balance is zero; listed after current members.
  - **Payments:** may be the payer or receiver of a new payment, as long as they appear in the household's history (`settlement.person.not_found` otherwise).
  - **New expenses:** refused as payer or as someone sharing (`expense.person.not_member`).
  - **Editing an expense that already includes them:** they may stay, in any role they already had in it; they can't be added to an expense they weren't in.
  - **The web:** shows a muted avatar and a "former member" badge.
- **Rationale:** FR-027 and FR-028, and the payment flow of Story 6 (settling with someone who moved out).

## R12 · Leaving with a balance, and the last member

- **Decision:** The leave and remove endpoints don't change: leaving with an open balance is allowed (clarification Q1). The web's leave and remove dialogs read `GET /api/household/balances` and add the person's open balance in words ("You still owe €15.00 in total…") to the confirmation (FR-026). Deleting the household when its last member leaves cascades to its expenses, shares and settlements through `householdId` foreign keys with `onDelete: Cascade`. The last-member confirmation copy now names expenses and payments (FR-030).
- **Rationale:** The rule is a warning, not a block, so it belongs in the interface. Data integrity comes from the cascade, so there is nothing to clean up by hand.

## R13 · UI building blocks

- **Decision:**
  - **New `packages/ui` components:**
    - **Amount** (+ `formatAmount`): a formatted euro figure with tabular numbers.
    - **ChoiceGroup**: fieldset, legend and options with label and hint, either single choice (radios) or `multiple` (checkboxes). It is extracted from the role picker in `InvitationsSection`, which migrates to it.
    - **Select**: a labelled native select with hint and error, matching `TextField`.
  - **Changed:** `Avatar` gets a `muted` variant for people who are no longer members.
  - **Web:** the expense form is a page (`/expenses/new`, `/expenses/:id/edit`), because it is long on a phone. The payment form is a `Dialog` (four fields).
- **Rationale:** Households R11 deferred a shared radio/select "until a second consumer appears". The split method picker, the people picker and the payer and payment selects are those consumers. Each new component follows the `Button` reference (test with axe, story, bilingual MDX). Native inputs give accessibility and good mobile pickers for free.
- **Alternatives rejected:** Radix Select (a custom listbox is harder on mobile and unnecessary here). Keeping the radio fieldset local to the web (now duplicated in two places).

## R14 · Refreshing without real time

- **Decision:** New queries: `["household", "activity"]` (infinite), `["household", "balances"]` and `["household", "expense", id]` / `["household", "settlement", id]`. They use `refetchOnWindowFocus: true` like the household query. Every expense or settlement mutation invalidates activity, balances and the record's own key. Leave and remove also invalidate balances.
- **Rationale:** It meets "data refreshes on navigation and window focus" until the real-time feature arrives (spec assumption, households R12).

## R15 · Testing the money rules thoroughly without new dependencies

- **Decision:** Besides hand-picked cases (rounding, single person, zero weights, €0.01, the spec examples), the `shared` tests run a seeded pseudo-random loop: a few hundred generated households, expenses and payments. For each one it asserts that shares add up to the amount, that balances sum to zero, that suggestions use at most `n − 1` payments, that applying them settles everyone, and that results are deterministic. A tiny seeded generator lives in the test file.
- **Rationale:** Principle IV asks for edge cases on money logic. Generated cases find rounding bugs that hand-written ones miss, and a fixed seed keeps failures reproducible.
- **Alternatives rejected:** `fast-check` (an extra dependency, which principle I would need justified, for what a 15-line loop does).

## R16 · Naming

- **Decision:** The interface says **payment** ("Record a payment", "Bruno paid Ana €10.70"). The code and database say **settlement** (`Settlement`, `/api/household/settlements`, `settlement.*` error codes), the name the constitution uses.
- **Rationale:** "Payment" is the everyday word in both languages (pago); "settlement" is precise and matches the constitution's domain rules.

## R17 · Deleting leaves a trace

- **Decision:** Deleting an expense or settlement is a soft delete. It sets `deletedAt` and `deletedById` (guarded by `version`, like edits) and keeps the row and its shares. Deleted records:
  - Never count: balances, suggestions, the viewer's part and the "people in the household's history" check all use live records only.
  - Answer 404 to `GET`, `PUT` and a second `DELETE` (`expense.not_found` / `settlement.not_found`).
  - Stay in the history feed at their original date as items with `deleted: { by, at }`. The web shows them as a muted line that can't be opened, such as "Ana deleted 'Groceries' (€42.80)" or "Ana deleted the payment from Bruno to Ana (€13.20)".
  - Have no restore action.
- **Rationale:** The clarification lets any MEMBER or ADMIN edit or delete any record and relies on openness for trust ("changed by Bruno"). A hard delete would be the one change that leaves no trace, and it's the most sensitive one (FR-025, design review).
- **Alternatives rejected:** Hard delete (silent). Soft delete with a **Restore** action (more endpoints and tests; re-adding a record covers the rare mistake). A separate audit log table (a new layer for one kind of event).
