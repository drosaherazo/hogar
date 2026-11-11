# Research: Expense categories with their own split

Phase 0 decisions. Each one names what was chosen, why, and what else was considered. The spec left no `NEEDS CLARIFICATION`; these decisions resolve the technical unknowns behind it.

## R1 · Categories are their own table; weights are keyed by membership

**Decision**: New `ExpenseCategory` table (household, name, optional emoji, `position`, `ownSplit`, `splitSavedAt`, `version`) and a `CategoryWeight` table keyed by `(categoryId, membershipId)` with a weight 0–100. Rows exist only while `ownSplit` is true. `Expense` gains a nullable `categoryId` with `ON DELETE SET NULL`.

**Rationale**:

- Keying weights by **membership**, not user, gives FR-019 for free: leaving or being removed deletes the membership, and `ON DELETE CASCADE` removes the person's weight from every category. The remaining weights don't change, so proportions are kept. Rejoining creates a new membership, which gets the joining weight like anyone else (R5).
- `ON DELETE SET NULL` on `Expense.categoryId` gives FR-009: deleting a category leaves its expenses without one and never touches `expense_shares`.
- Shares stay in `expense_shares`, fixed at save time. No category change can reach them except an edit of that expense (FR-020, FR-025).

**Alternatives considered**:

- _Weights as a JSON column on the category_: no foreign keys, so leaving would need manual cleanup and the CHECK on 0–100 couldn't be enforced per entry.
- _Keyed by user_: survives rejoining, but then a former member keeps a stale weight that must be filtered everywhere, and rejoining would bring back a weight nobody reviewed.
- _Soft-deleting categories_: the interview chose "left without a category" (spec Story 2 #4); archiving is out of scope.

## R2 · One shared function decides the default weights

**Decision**: Add `defaultWeights(members, category)` to `packages/shared/src/split.ts`. It returns the weights in member order: the category's own weights when `category.ownSplit` is true, the household's weights otherwise (no category, or a category that follows the household). The existing `splitAmount` turns them into cents. The API uses it to save, and the web uses it for the form preview and the before/after comparison.

**Rationale**: Principle II requires web and API to compute the same split. With one function, the preview the person approves is computed exactly like the saved shares (FR-023, SC-005). The leftover-cent rule, weight 0 and the all-zero case are inherited from `splitAmount` unchanged (FR-016, FR-017).

**Alternatives considered**: _Let the API return a preview endpoint_ (`POST /expenses/preview`): one more round trip per keystroke for something the web can compute exactly.

## R3 · Changing an expense's category: an explicit "reapply" with the previewed shares

**Decision**: The `WEIGHTS` split input gains an optional `reapply` field: `{ method: "WEIGHTS", reapply?: { shares: { userId, amountCents }[] } }`.

- **Without `reapply`** (today's behavior, research 002 R3): an edited default-split expense keeps its saved shares, rescaled if the amount changed. This covers "keep the current shares" and every edit that doesn't touch the category.
- **With `reapply`**: the API recomputes the shares from the current default weights of the expense's (new) category with `defaultWeights` + `splitAmount`, compares them with `reapply.shares`, and saves them only if they match. Otherwise it answers 409 `expense.split.changed` and saves nothing.
- On **create**, `WEIGHTS` always uses the category's current weights, so `reapply` is ignored.

**Rationale**:

- FR-022–FR-024 need two outcomes from the same edit, so the client must say which one the person chose. Defaulting to "keep" means older clients and every other edit behave exactly as today.
- Sending the previewed shares closes the one gap in FR-023: if an admin changes the category's weights between the preview and the save, the person would otherwise save shares they never saw. The 409 makes the form refetch and show the new preview, like `expense.changed` already does.
- The web only sends `reapply` when the before/after dialog was shown and "apply" was chosen. When the new category gives the same shares (FR-024), it sends no `reapply`, and keeping the saved shares gives the same result.

**Alternatives considered**:

- _Always recompute when the category changes_: breaks "tidy the history without moving balances" (Story 4).
- _Send the chosen shares as `EXACT`_: saves the right cents, but the expense would stop being a default-split expense, so a later amount correction would no longer rescale it (002 R3).
- _A category version in the request_: catches changes to the category but not to the household's weights or members, which also change the result.

## R4 · Starter set: shared constants, localized with `User.locale`, backfilled in the migration

**Decision**: `packages/shared/src/categories.ts` exports `STARTER_CATEGORIES`, five entries with an emoji and an `en`/`es` name: 🏠 Rent / Alquiler, 🛒 Groceries / Comida, 💡 Utilities / Suministros, 🎉 Leisure / Ocio, 📦 Other / Otros.

- **New households**: `householdService.create` inserts them in the creator's `User.locale` (fallback `en`), in the same transaction as the household.
- **Existing households**: the migration inserts them once per household in the locale of its longest-standing admin (earliest `joined_at` among `ADMIN` memberships), with `position` 1–5.

**Rationale**:

- Once created, starter categories are household data that admins rename and delete, not interface copy. Constitution V allows server-produced text when it is localized with `User.locale`; the creator's locale is the best signal at creation time.
- A SQL backfill runs exactly once per database, with the deploy, and needs no app code that survives the migration (FR-002: "once").
- IDs in the backfill use `gen_random_uuid()::text` (built into Postgres 13+, available on Neon and in Docker). Ids are opaque strings everywhere, so mixing them with cuids is harmless.

**Alternatives considered**:

- _Translation keys stored as names_ ("starter.rent" translated on read): breaks as soon as an admin renames one, and two kinds of names would need two code paths.
- _A one-off backfill script_: easy to forget on deploy; the migration is the only step that is guaranteed to run.
- _Lazy creation on first read_: a write hidden inside a GET, racing between two readers.

## R5 · Joining, leaving and the review notice

**Decision**:

- **Joining**: `invitationService.accept` inserts a `CategoryWeight` with `defaultWeightFor(role)` (1 for `MEMBER`, 0 for `GUEST`) for every category of the household with `ownSplit = true`, in the transaction that creates the membership (FR-018).
- **Review notice**: `CategoryView.needsReview` is true when the category uses its own split, the household has at least two members, and either `splitSavedAt < household.membersChangedAt` or all its weights are 0. It mirrors `HouseholdView.splitNeedsReview`, so leaving and removals also raise it.
- **Leaving**: handled by the cascade (R1).

**Rationale**: the same rule people already know from the household's split, and the same columns (`membersChangedAt` is bumped on every membership change already).

**Alternatives considered**: _Giving joiners 0 in every category_ was rejected in the interview: the error is silent (spec Story 3 #9).

## R6 · Saving a category's split follows the household's split endpoint

**Decision**: `PUT /api/household/categories/:id/split` takes `{ version, ownSplit: false }` or `{ version, ownSplit: true, weights: { membershipId, weight }[] }`.

- The weights must match the current memberships exactly, or the save is refused with 409 `split.members_changed`, as in `PUT /api/household/split`.
- All-zero weights are refused with 400 `split.all_zero`. A category can still end up all-zero later (when its only paying member leaves), and expenses handle that with `expense.split.no_default` (FR-017).
- Turning the box off deletes the category's weights. Saving sets `splitSavedAt` and bumps `version`.
- Ticking the box in the web prefills the editor with a copy of the household's weights (FR-013). Nothing is saved until the admin saves.

**Rationale**: reuses the household's validation, error codes and editor, so admins meet one mental model.

**Alternatives considered**: _Saving on tick_: a click with no Save button would create weights the admin hasn't looked at yet.

## R7 · Names and emoji

**Decision**:

- **Names**: trimmed, 1–30 characters. Uniqueness ignoring case is enforced by the service under the household lock (`lower(name)` comparison) and backed by a unique expression index on `(household_id, lower(name))`. A collision returns 400 `category.name.taken`.
- **Emoji**: optional, validated in the shared schema as exactly one grapheme (`Intl.Segmenter`, available in Node 24 and evergreen browsers) that contains an emoji code point (`\p{Extended_Pictographic}` or a regional indicator pair), at most 16 UTF-16 units. Otherwise 400 `category.emoji.invalid`. Empty means none.
- **Limit**: 30 categories per household, counted under the household lock: 400 `category.limit_reached`.

**Rationale**: flags and skin tones are several code points but one grapheme, which matches "one emoji as people perceive it" (spec Assumptions). The lock prevents two admins from passing the uniqueness or limit check at once.

**Alternatives considered**: _An emoji picker library_: a new dependency for something every mobile keyboard and OS already offers; rejected under Principle I.

## R8 · Order of categories

**Decision**: An integer `position`, set to `max + 1` under the household lock when a category is created. Lists order by `position`.

**Rationale**: FR-005 needs a stable order. The five starter categories are created in one transaction with the same timestamp, so `createdAt` can't order them, and random ids can't either.

**Alternatives considered**: _Ordering by name_: the starter set would come out in a different order in each language.

## R9 · Filtering the history

**Decision**: `GET /api/household/activity` accepts `category=<id>` or `category=none`.

- With a filter, only expenses (live and deleted) matching it are returned and **settlements are left out** (spec edge case).
- Keyset pagination and the cursor stay as they are. An unknown id gives an empty page, not an error, because the category may just have been deleted.
- An index on `(household_id, category_id)` keeps the filtered query indexed.
- Balances never take the filter (FR-027).

**Rationale**: one endpoint and one list component; the filter is part of the query key, so TanStack Query caches each view separately.

## R10 · Concurrency and permissions

**Decision**:

- **Versions**: categories carry a `version`. `PATCH`, `PUT …/split` and `DELETE` must name it; a mismatch gives 409 `category.changed` (FR-030), as with expenses.
- **Permissions**: every write runs `requireAdmin` (403 `household.forbidden` for MEMBER and GUEST), and `GET` is open to any member (FR-004, FR-029).
- **Choosing a category** on an expense stays an editor action (MEMBER or ADMIN). The id must belong to the caller's household, or the request gets 400 `expense.category.not_found`. That same answer covers a category deleted while the form was open.

**Rationale**: same patterns as the household and expenses features, so the permission matrix stays readable.

## R11 · The "use its own split" box is a new `Checkbox` in `packages/ui`

**Decision**: Add a `Checkbox` component (native `<input type="checkbox">` with a visible label and optional hint) to `packages/ui`, with test, axe, story and bilingual MDX. The weight editor already in `SplitSection` moves to `apps/web/src/household/WeightsEditor.tsx` so the household's split and each category's split use the same rows.

**Rationale**:

- The spec (FR-011) and the user's request name a single box. A native checkbox is the most accessible control for an on/off choice.
- `ChoiceGroup` models a group of options and would turn it into two radios.

**Alternatives considered**: _A switch_: implies an immediate effect, but here nothing is saved until Save (R6).

## R12 · How categories look

**Decision**: Wherever a category appears (history rows, details, form, filter), it shows as an emoji followed by the name, in a neutral `Badge`. The emoji is `aria-hidden` and the name is always present (FR-032). There is no color per category.

**Rationale**: the constitution allows one vivid brand color and requires that color never carries meaning on its own. The emoji brings the joy and quick recognition, and the name carries the meaning.

## R13 · The "when it was added" label becomes neutral

**Decision**: The edit form's label for a saved default split changes from "The household's split when it was added: …" to "The split when it was added: …".

**Rationale**: after a category change that kept the shares, the saved proportions may no longer belong to the category or to the household (spec edge case: "its category alone does not imply its split"). The label must not claim where they came from. No new column is needed: the proportions are still read from the saved shares.

## R14 · Testing strategy

**Decision**:

- **Shared (Vitest)**: `defaultWeights` (no category, follows household, own split, all-zero, former members ignored), the category schemas (name, emoji graphemes such as flags, skin tones and ZWJ sequences, plus invalid text), and en/es parity of `STARTER_CATEGORIES`.
- **API (Supertest)**: every category endpoint × the permission matrix in `contracts/api.md`; creating a household seeds the starter set in the creator's locale; uniqueness, limit and versions; joining adds weights and raises the notice; leaving removes them; deleting a category leaves expenses uncategorized with identical shares and balances; create and edit with a category; `reapply` match and 409; the activity filter.
- **UI and web**: the `Checkbox` component (test, axe, story); the categories section, form, dialog and filter tested with Testing Library + MSW.
- **Cypress**: the three flows in `quickstart.md`, with a second user simulated through API calls.
- **Backfill**: verified by hand once against a copy of the database (`quickstart.md`), because migrations have already run before the test suite starts.
