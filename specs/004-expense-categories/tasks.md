---
description: "Task list for the expense categories feature"
---

# Tasks: Expense categories with their own split

**Input**: Design documents from `specs/004-expense-categories/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Tests**: Included. Constitution IV requires unit tests for domain logic, Supertest for every
endpoint and every cell of the permission matrix in [contracts/api.md](./contracts/api.md), a test
(with axe) and a story for every `packages/ui` component, and Cypress for the main flows. Within each
story, write the tests first and see them fail before implementing.

**Organization**: Shared code, data and the `Checkbox` come first (Phases 1–2), then one phase per
user story in spec priority order (US1–US5), then E2E and polish. Each story phase ends green on
format, lint, typecheck and tests, and can be committed and shipped on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Start from a green baseline in this worktree.

- [x] T001 From the repo root, run `pnpm install`, `pnpm db:up` and `pnpm db:migrate`, then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`. Everything must be green on `feat/expense-categories` before any change; if something fails, fix the environment (see `CLAUDE.md` › Commands), not the code.

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: Shared schemas and split logic, the database, and the `Checkbox` component that every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared (`packages/shared`)

- [x] T002 [P] Add the 9 new error codes to `ERROR_CODES` in `packages/shared/src/errors.ts`: `category.name.required`, `category.name.too_long`, `category.name.taken`, `category.emoji.invalid`, `category.limit_reached`, `category.not_found`, `category.changed`, `expense.category.not_found`, `expense.split.changed`. Add warm messages for each to `apps/web/src/i18n/locales/en/errors.json` and `apps/web/src/i18n/locales/es/errors.json`, following the file's existing key nesting; use the two examples in [contracts/api.md › New error codes](./contracts/api.md#new-error-codes-9) verbatim (`category.name.taken`: "There's already a category with that name." / "Ya hay una categoría con ese nombre."; `expense.split.changed`: "The split changed while you were editing. Here are the new shares." / "El reparto ha cambiado mientras editabas. Estas son las partes nuevas."). The i18n parity test in `apps/web/src/i18n/i18n.test.ts` must stay green.
- [x] T003 [P] Create `packages/shared/src/categories.ts` with the types of [contracts/api.md › Types](./contracts/api.md#types-shared-zod-packagessharedsrccategoriests), using the `code(...)` error-code helper pattern from `expenses.ts`:
  - `CATEGORY_NAME_MAX = 30` and `MAX_CATEGORIES = 30`.
  - `categoryNameSchema`: "trimmed, 1–30 chars"; empty after trim → `category.name.required`, longer than 30 → `category.name.too_long`.
  - `categoryEmojiSchema`: "exactly one grapheme (`Intl.Segmenter`) that contains an emoji code point (`\p{Extended_Pictographic}` or a regional indicator pair), at most 16 UTF-16 units", otherwise `category.emoji.invalid`. Trim first; an empty string becomes `null` ("Empty means none", R7).
  - `categoryRefSchema` `{ id, name, emoji: string | null }`; `categoryWeightViewSchema` `{ membershipId, userId, weight: 0–100, shareBps }`; `categoryViewSchema` `{ id, name, emoji, position, ownSplit, weights: CategoryWeightView[] | null, needsReview, expenseCount, version }`; `categoryListSchema` `{ categories }` and `categoryResponseSchema` `{ category }`.
  - `createCategoryInputSchema` `{ name, emoji?: emoji | null }`; `updateCategoryInputSchema` `{ name, emoji: emoji | null, version: int ≥ 1 }`.
  - `updateCategorySplitInputSchema`, a discriminated union on `ownSplit`: `{ version, ownSplit: false }` or `{ version, ownSplit: true, weights: { membershipId, weight }[] }`. Reuse `weightSchema` (0–100, `split.weight.invalid`) from `household.ts`; weights must be non-empty with unique `membershipId`s (`request.invalid`), and not all 0 (`split.all_zero`), mirroring `updateSplitRequestSchema`.
  - `STARTER_CATEGORIES` (readonly, in this order): 🏠 Rent / Alquiler, 🛒 Groceries / Comida, 💡 Utilities / Suministros, 🎉 Leisure / Ocio, 📦 Other / Otros, as `{ emoji, name: { en, es } }`.
- [x] T004 [P] Add `defaultWeights(members, category)` to `packages/shared/src/split.ts` (R2). `members` is the current members in member order, each `{ membershipId, weight }`; `category` is `null` or `{ ownSplit: boolean, weights: { membershipId, weight }[] | null }`. Return one number per member, in member order: the category's weight for that membership when `category?.ownSplit` is true (a current member without a row gets 0, rows for former memberships are ignored), the household weights otherwise. Do not change `splitAmount`. Add cases to `packages/shared/src/split.test.ts`: no category, category following the household, own split (household 3/1, category 1/1 → `splitAmount(90000, …)` gives 45000/45000), own split all 0 (and `splitAmount` behavior unchanged for it), a row for a former member ignored, a member missing a row gets 0, a single member, and leftover cents still going to the first members.
- [x] T005 Extend `packages/shared/src/expenses.ts` (depends on T003):
  - `expenseFields` gains `categoryId: z.string().min(1).nullable().optional()`, normalized to `null` when absent, so `ExpenseInput.categoryId` is `string | null`.
  - The `WEIGHTS` branch of `expenseSplitInputSchema` gains `previewShares?: { userId, amountCents }[]` (amounts int ≥ 0, unique `userId`s), the shares the form showed (R3). It stays optional in the schema; the API decides when it is required (T017).
  - `expenseViewSchema` and the `"expense"` branch of `activityItemSchema` gain `category: categoryRefSchema.nullable()`.
  - `activityQuerySchema` gains `category: z.string().min(1).max(64).optional()` (a category id or `"none"`).
  - Add cases to `packages/shared/src/expenses.test.ts`: missing `categoryId` parses to `null`; `WEIGHTS` with and without `previewShares`; `previewShares` with duplicate users is rejected; activity query with `category=none`.
- [x] T006 Re-export everything from `categories.ts` in `packages/shared/src/index.ts`, then run `pnpm --filter @hogar/shared test` and `pnpm typecheck`. Fix any app compile errors caused by the new required view fields by adding `category: null` where views or fixtures are built (e.g. web test fixtures), without implementing the feature yet.
- [x] T007 [P] Add category schema cases to a new `packages/shared/src/categories.test.ts`: names (trim, empty → `category.name.required`, 31 chars → `category.name.too_long`, 30 chars ok); emoji accepted: `🏠`, a flag `🇪🇸`, a skin tone `👍🏽`, a ZWJ sequence `👩‍👩‍👧`; emoji rejected: `ab`, `🏠🛒`, a plain letter, `:)`; empty emoji → `null`; split input: duplicate membership → rejected, all 0 → `split.all_zero`, weight 101 → `split.weight.invalid`; `STARTER_CATEGORIES` has 5 entries with non-empty `en` and `es` names and an emoji each.

### Data (`apps/api`)

- [x] T008 Update `apps/api/prisma/schema.prisma` per [data-model.md](./data-model.md), following the file's `@map`/`@@map` snake_case conventions:
  - `ExpenseCategory` (`expense_categories`): `id String @id @default(cuid())`; `householdId` FK → `households.id` `onDelete: Cascade`; `name String` ("trimmed, 1–30 chars; unique per household ignoring case"); `emoji String?`; `position Int`; `ownSplit Boolean @default(false)`; `splitSavedAt DateTime?`; `version Int @default(1)`; `createdAt DateTime @default(now())`; relations `household`, `weights CategoryWeight[]`, `expenses Expense[]`; `@@index([householdId, position])`.
  - `CategoryWeight` (`category_weights`): `categoryId` FK → `expense_categories.id` `onDelete: Cascade`; `membershipId` FK → `memberships.id` `onDelete: Cascade`; `weight Int` ("0–100, `CHECK`"); `@@id([categoryId, membershipId])`; `@@index([membershipId])`.
  - `Expense.categoryId String?` FK → `expense_categories.id` `onDelete: SetNull`, plus `@@index([householdId, categoryId])`.
  - Back-relations `Household.categories ExpenseCategory[]` and `Membership.categoryWeights CategoryWeight[]`.
- [x] T009 Generate the migration with `pnpm --filter @hogar/api exec prisma migrate dev --create-only --name expense_categories`, then append the SQL block from [data-model.md › Migration SQL](./data-model.md#migration-sql-appended-to-the-generated-file) verbatim to `apps/api/prisma/migrations/<timestamp>_expense_categories/migration.sql` (the `CHECK`, the unique `(household_id, lower(name))` index and the starter-set backfill). Apply it with `pnpm db:migrate` and regenerate the client; make sure the test database `hogar_test` gets it the same way the existing migrations do (`apps/api/test/globalSetup.ts`).
- [x] T010 Add `"category_weights"` and `"expense_categories"` to the `TRUNCATE` statement in `apps/api/test/testApp.ts` (before `"expenses"`), and run `pnpm --filter @hogar/api test` to confirm the existing suite is still green.
- [x] T011 Add a starter-set parity case to `packages/shared/src/categories.test.ts` (depends on T009): read the `*_expense_categories/migration.sql` file from `apps/api/prisma/migrations/` with `node:fs` (resolve the path from `import.meta.url`), extract the `VALUES` tuples, and assert that position, emoji, `en` and `es` names match `STARTER_CATEGORIES` exactly and in order.

### UI component (`packages/ui`)

- [x] T012 [P] Create `packages/ui/src/components/Checkbox/Checkbox.tsx` and `Checkbox.module.css` per [contracts/ui.md › `packages/ui` · new `Checkbox`](./contracts/ui.md#packagesui--new-checkbox): props `label` (required, visible), optional `hint`, plus native input props (`checked`, `defaultChecked`, `onChange`, `disabled`, `name`, `id`); native `<input type="checkbox">` inside or tied to its `<label>`; the hint is linked with `aria-describedby` (use `useId`); forward the ref. Semantic tokens only (`--color-*`, `--space-*`, focus ring like `TextField`), works in light and dark, no copy. Export it (and its props type) from `packages/ui/src/index.ts`.
- [x] T013 [P] Create `packages/ui/src/components/Checkbox/Checkbox.test.tsx` following the other components' tests: renders the label, toggles on click and on Space, calls `onChange`, respects `disabled`, links the hint through `aria-describedby`, and passes axe checked and unchecked (use the package's existing axe helper).
- [x] T014 Create `packages/ui/src/components/Checkbox/Checkbox.stories.tsx` (default, checked, with hint, disabled) and the bilingual `Checkbox.mdx` docs page following the other components' `.mdx` (why a native checkbox and not a switch: nothing is saved until Save; why a visible label and hint; how it helps the person), then run `pnpm --filter @hogar/ui test` and `pnpm --filter @hogar/ui build-storybook` (or the package's Storybook build script).

### Preview check (`previewShares`, R3)

Fresh default shares are saved only when they match what the person saw. These tasks add the check with today's household weights; US3 makes the computation category-aware (T049) and US4 adds the category-change path (T060).

- [x] T015 [P] Add cases to `apps/api/test/expenses.test.ts` (household 3/1, €900.00): create with `WEIGHTS` and matching `previewShares` → 201 with those shares; create with `WEIGHTS` and no `previewShares` → 400 `request.invalid`; create with `previewShares` computed before `PUT /api/household/split` changed the weights → 409 `expense.split.changed`, nothing saved; edit an `EQUAL` expense to `WEIGHTS` without `previewShares` → 400 `request.invalid`, with matching ones → saved, with stale ones → 409 and the expense unchanged (shares, method, version); edit `WEIGHTS` → `WEIGHTS` without `previewShares` keeps the saved shares (existing tests stay green).
- [x] T016 Update `postExpense`, `addExpense`, `putExpense` and `inputOf` in `apps/api/test/expenseHelpers.ts` so a `WEIGHTS` input without `previewShares` gets them computed from the current household (`GET /api/household` → `defaultWeights(members, null)` + `splitAmount`), unless the test passes `previewShares` explicitly or opts out to test the 400. Fix any other test that posts `WEIGHTS` expenses directly (`activity`, `balances`, `formerMembers`, `settlements`, `members`), so the existing suite stays green with the check in place.
- [x] T017 In `apps/api/src/expenses/expenseService.ts`, add `assertPreview(computed, previewShares)`: missing → 400 `request.invalid`; a different set of people or any different cents → 409 `expense.split.changed`. Call it inside the transaction (after `lockHousehold`) on create with `WEIGHTS` and on edits that go from `EQUAL`/`EXACT` to `WEIGHTS`, i.e. wherever `computeSplit` computes fresh `WEIGHTS` shares. `WEIGHTS` → `WEIGHTS` edits without `previewShares` keep `computeEditedSplit` unchanged. Run `pnpm --filter @hogar/api test` (T015 green).
- [x] T018 In `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx`, send `previewShares` (the shares of the `WEIGHTS` preview, as `{ userId, amountCents }`) when adding with `WEIGHTS` and when switching an `EQUAL`/`EXACT` expense to `WEIGHTS`; not for `WEIGHTS` → `WEIGHTS` edits. On 409 `expense.split.changed`, keep every field, refetch the household, show the new preview and the translated error, and let the person save again. Add cases to `ExpenseFormPage.test.tsx` (the POST body carries `previewShares`; a 409 shows the error and the refreshed preview; a `WEIGHTS` → `WEIGHTS` edit sends none). Update the POST/PUT body assertions and fixtures in `apps/web/cypress/e2e/expenses.cy.ts` accordingly.

**Checkpoint**: Shared schemas, `defaultWeights`, error codes, the database, `Checkbox` and the preview check are in place; every existing test is green. Commit in small steps (`feat(shared): …`, `feat(api): add expense categories migration`, `feat(ui): add Checkbox`).

---

## Phase 3: User Story 1 - Say what an expense was for (Priority: P1) 🎯 MVP

**Goal**: New households get the starter set, everyone can read the list, editors can put a category (or none) on an expense, and the category shows on rows and details.

**Independent Test**: In a new household, add one expense with a starter category and one without; the first shows its label in the list and in its detail, the second shows nothing extra and is split with the household's weights exactly as before. A GUEST sees categories but can't set them.

### Tests for User Story 1 ⚠️

- [x] T019 [P] [US1] Create `apps/api/test/categories.test.ts` with the US1 cases, using `createHousehold`/`addMember` from `householdHelpers.ts` and `homeWith`/`homeWithGuest` from `expenseHelpers.ts` (add a small `listCategories(app, who)` helper there):
  - `POST /api/household` seeds the five starter categories in the creator's `User.locale`: `en` → Rent, Groceries, Utilities, Leisure, Other; `es` → Alquiler, Comida, Suministros, Ocio, Otros; with positions 1–5, the emoji from `STARTER_CATEGORIES`, `ownSplit: false`, `weights: null`, `needsReview: false`, `expenseCount: 0`, `version: 1`.
  - `GET /api/household/categories` permission row: ADMIN, MEMBER and GUEST 200; former member 404; no household 404 `household.not_member`; a user of another household sees only their own categories.
  - Categories come back ordered by `position`; `expenseCount` counts live expenses only (a deleted expense doesn't count).
- [x] T020 [P] [US1] Add US1 cases to `apps/api/test/expenses.test.ts`: create with a `categoryId` as MEMBER and as ADMIN returns `category: { id, name, emoji }` on the view and on `GET /expenses/:id`; create without `categoryId` returns `category: null` and the same shares as before; GUEST → 403 `household.read_only`; a `categoryId` from another household → 400 `expense.category.not_found`; an unknown id → 400 `expense.category.not_found`; editing an `EQUAL` and an `EXACT` expense to add, change and remove its category changes only the category (shares identical to the cent, FR-021).
- [x] T021 [P] [US1] Add a case to `apps/api/test/activity.test.ts`: expense items carry `category` (a ref or `null`); settlement items are unchanged.

### Implementation for User Story 1

- [x] T022 [P] [US1] Create `apps/api/src/categories/categoryView.ts`: `toCategoryView(category, members, household)` returning `CategoryView`. `weights` is `null` unless `ownSplit`; otherwise one entry per current membership in member order with `shareBps` from `weightsToBasisPoints`. `needsReview` per R5: `ownSplit` && household has ≥ 2 members && (`splitSavedAt < household.membersChangedAt` || all weights 0). `expenseCount` comes from the caller. Also export `toCategoryRef(category | null)`.
- [x] T023 [US1] Create `apps/api/src/categories/categoryService.ts` with `createCategoryService({ db })` and `list(actor)`: two queries (categories with weights ordered by `position`, and a `groupBy` count of expenses with `deletedAt: null` per `categoryId`), plus the members and household needed by `toCategoryView`. Add `seedStarterCategories(tx, householdId, locale)` that inserts `STARTER_CATEGORIES` with names in `locale` (`es` → `es`, anything else → `en`) and positions 1–5.
- [x] T024 [US1] Create `apps/api/src/categories/categoriesRouter.ts` (`createCategoriesRouter(db, categories)`) with `GET /` using `loadMembership` like `expensesRouter.ts`, answering `{ categories }`. Mount it in `apps/api/src/app.ts` as `app.use("/api/household/categories", requireAuth(signer), createCategoriesRouter(db, categories))` next to the expenses and settlements routers, **before** the `/api/household` ledger and household routers.
- [x] T025 [US1] In `apps/api/src/household/householdService.ts`, call `seedStarterCategories` inside the transaction of `create`, using the creator's `User.locale` (fallback `en`).
- [x] T026 [US1] In `apps/api/src/expenses/expenseService.ts`: on create and update, if `categoryId` is not null, load it with `{ id, householdId: actor.householdId }` inside the transaction and throw 400 `expense.category.not_found` when missing; persist `categoryId`; include `category: { select: { id, name, emoji } }` wherever expenses are loaded for views, and set `category` on `ExpenseView` with `toCategoryRef`. Split behavior is unchanged in this story.
- [x] T027 [US1] In `apps/api/src/expenses/ledgerService.ts`, include the category in the expense query and add `category` to `"expense"` activity items. Run `pnpm --filter @hogar/api test` (T019–T021 green).
- [x] T028 [P] [US1] Add `getCategories(): Promise<CategoryList>` to `apps/web/src/api/client.ts` (`GET /api/household/categories`, parsed with `categoryListSchema` like the other methods), with a case in `apps/web/src/api/client.test.ts`. Add a default MSW handler for `GET /api/household/categories` returning the five `en` starter categories in `apps/web/src/test/server.ts` (or where the default handlers live), so existing page tests keep passing.
- [x] T029 [P] [US1] Create `apps/web/src/expenses/useCategories.ts` with `useCategories()` (TanStack Query, key `["categories"]`, refetch on focus like `useHousehold`) and a `categoryKeys` helper; mutations come in US2/US3.
- [x] T030 [P] [US1] Create `apps/web/src/expenses/CategoryLabel.tsx` (R12): a neutral ui `Badge` with the emoji in a `<span aria-hidden="true">` followed by the name; renders nothing for `null`. Add `CategoryLabel.test.tsx`: shows the name, the emoji is hidden from the accessibility tree (`getByText(name)` and the accessible text equals the name), nothing for `null`, passes axe.
- [x] T031 [US1] Add the category `Select` to `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx`, right after the description: options "No category" first (value `""`, the default) then each category as `"🏠 Rent"` in list order; send `categoryId` (`null` for `""`) on create and edit; prefill from `expense.category` when editing. Add keys `form.category.label` ("Category" / "Categoría") and `form.category.none` ("No category" / "Sin categoría") to `apps/web/src/i18n/locales/{en,es}/expenses.json`. If there are no categories, still render the select with only "No category" (Story 2 #7). Add cases to `ExpenseFormPage.test.tsx`: the select lists "No category" plus the categories; saving sends the chosen `categoryId`; saving without choosing sends `null`; editing preselects the saved category; axe still passes.
- [x] T032 [P] [US1] Show `CategoryLabel` under the description of expense rows in `apps/web/src/expenses/ActivityList.tsx` (live rows only: `DeletedRow` stays unchanged, so a deleted expense's line is unaffected by later category changes, spec edge case; rows without a category show nothing extra; style in `ActivityList.module.css` with tokens), and under the description in `apps/web/src/pages/ExpenseDetailPage/ExpenseDetailPage.tsx`. Add cases to `ExpensesPage.test.tsx` and `ExpenseDetailPage.test.tsx`: the label appears for a categorized expense and not for an uncategorized one, and a deleted categorized expense's line shows no label.
- [ ] T033 [US1] Run the `docs/design.md` checklist on the form, the rows and the detail (light and dark, `en` and `es`, keyboard only), then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint**: US1 is functional and shippable: starter set, categorizing, labels. Commit (`feat(api): …`, `feat(web): …`).

---

## Phase 4: User Story 2 - Make the categories fit the home (Priority: P2)

**Goal**: Admins add, rename, change the emoji of and delete categories in the household settings; everyone else sees the list read-only.

**Independent Test**: As an admin, add a category, rename another and delete a third that has expenses; the form offers the updated list, renamed expenses show the new name, the deleted one's expenses have no category and identical shares and balances, and a MEMBER and a GUEST can see the list but not change it.

### Tests for User Story 2 ⚠️

- [x] T034 [P] [US2] Add US2 cases to `apps/api/test/categories.test.ts`:
  - `POST`: ADMIN 201 with `position = max + 1`, `ownSplit: false`; MEMBER and GUEST 403 `household.forbidden`; former member and no household 404; a user of another household creates in their own household. Validation: empty name → `category.name.required`, 31 chars → `category.name.too_long`, `"  groceries "` when "Groceries" exists → `category.name.taken`, two emoji → `category.emoji.invalid`; 31st category → `category.limit_reached`.
  - `PATCH /:id`: ADMIN renames and changes emoji, `version` bumps, and the shares and balances of its expenses are identical (`sharesByUser`, `balancesOf`); renaming to its own name with different case is allowed; stale `version` → 409 `category.changed`; MEMBER/GUEST 403; an id from another household → 404 `category.not_found`.
  - `DELETE /:id?version=`: no version → 400 `request.invalid`; stale → 409 `category.changed`; MEMBER/GUEST 403; other household → 404. A category with live and deleted expenses: after delete, both have `category: null`, every share and balance is identical, and `GET` no longer lists it; its name can be reused by a new category; deleting the last category leaves an empty list and expenses can still be created.
- [x] T035 [P] [US2] Create `apps/web/src/pages/HouseholdSettingsPage/CategoriesSection.test.tsx` (MSW): an ADMIN sees the list in order with labels and summaries, "Add category" and one "Edit {{name}}" per row; a MEMBER and a GUEST see the list, the read-only note and no buttons; with 30 categories "Add category" is disabled and the limit note is visible; with none, the empty state shows; axe passes.
- [x] T036 [P] [US2] Create `apps/web/src/pages/HouseholdSettingsPage/CategoryDialog.test.tsx` (MSW): adding sends `POST` with trimmed name and emoji and closes with the "Category saved." status; a `category.name.taken` response shows the translated message next to the name field; renaming sends `PATCH` with the latest `version` only when name or emoji changed; delete shows the confirmation with the count (`used_one`, `used_other`, `unused`) and, for a category with its own split, the `ownSplit` line; focus starts on Cancel; confirming sends `DELETE ?version=`; a 409 `category.changed` shows its message and refetches; axe passes.

### Implementation for User Story 2

- [x] T037 [US2] Add `create`, `rename` and `remove` to `apps/api/src/categories/categoryService.ts`, each in a transaction that starts with `lockHousehold(tx, actor.householdId)`:
  - `create`: count ≥ `MAX_CATEGORIES` → 400 `category.limit_reached`; a category with `lower(name) = lower(input.name)` → 400 `category.name.taken`; `position = max(position) + 1` (1 when none); `ownSplit: false`.
  - `rename`: load by `{ id, householdId }` or 404 `category.not_found`; `version` mismatch → 409 `category.changed`; name taken by **another** category → 400 `category.name.taken`; update name and emoji and bump `version`. Never touch expenses.
  - `remove`: same lookup and version check; delete the category (weights cascade, expenses get `NULL` from the FK). Never touch shares.
  - Map a unique-index violation (Prisma `P2002`) on the name index to `category.name.taken` as a fallback.
- [x] T038 [US2] Add `POST /`, `PATCH /:id` and `DELETE /:id` to `apps/api/src/categories/categoriesRouter.ts` with `requireAdmin` from `loadMembership.ts`, validating bodies with `createCategoryInputSchema` / `updateCategoryInputSchema` and the delete query with `versionQuerySchema` (missing → 400 `request.invalid`), answering 201 `{ category }`, 200 `{ category }` and 204. Run `pnpm --filter @hogar/api test` (T034 green).
- [x] T039 [P] [US2] Add `createCategory(input)`, `updateCategory(id, input)` and `deleteCategory(id, version)` to `apps/web/src/api/client.ts` (with `client.test.ts` cases), and the matching mutations to `apps/web/src/expenses/useCategories.ts`; every mutation invalidates `categories`, `activity` and `household` queries on success.
- [x] T040 [US2] Create `apps/web/src/pages/HouseholdSettingsPage/CategoryDialog.tsx` (ui `Dialog`) for adding and editing name and emoji: `TextField` name (max 30) and emoji (optional, hint "Pick one from your keyboard."); Save, Cancel and, when editing, "Delete category" opening a confirmation `Dialog` that names the category, shows `delete.used` (pluralized by `expenseCount`) or `delete.unused`, adds `delete.ownSplit` when the category has its own split (spec edge case), and starts focus on Cancel. Errors from the API are translated through `errorKey` and shown next to the matching field (`category.name.*` → name, `category.emoji.invalid` → emoji) or as an `Alert`. Leave a clear spot for the split controls added in US3.
- [x] T041 [US2] Create `apps/web/src/pages/HouseholdSettingsPage/CategoriesSection.tsx` per [contracts/ui.md › Settings · Categories section](./contracts/ui.md#settings--categories-section-categoriessectiontsx): title and description, one row per category with `CategoryLabel` and the summary "Follows the household's split" (own-split summary added in US3), "Add category" and "Edit {{name}}" for ADMINs only, the read-only note for others, disabled add plus `limit` note at `MAX_CATEGORIES`, and an `EmptyState` (`settings.categories.empty`) with no categories. Render it in `HouseholdSettingsPage.tsx` right after the Split section, inside an element with `id="categories"` so `/household#categories` scrolls to it.
- [x] T042 [US2] Add the `household` keys of [contracts/ui.md › Planned i18n keys](./contracts/ui.md#planned-i18n-keys) used so far (`settings.categories.title`, `description`, `add`, `edit`, `readOnly`, `followsHousehold`, `limit`, `empty`, `dialog.titleNew`, `dialog.name`, `dialog.emoji`, `dialog.emojiHint`, `dialog.save`, `dialog.saved`, `delete.action`, `delete.title`, `delete.used_one`, `delete.used_other`, `delete.unused`, `delete.ownSplit`) to `apps/web/src/i18n/locales/{en,es}/household.json` with the texts from that table. The edit dialog's title uses `settings.categories.edit`.
- [x] T043 [US2] Handle a category deleted while the form is open in `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx` (edge case, UI contract › Deleted category): on 400 `expense.category.not_found`, keep every other field, refetch categories, reset the select to "No category" and show the translated error next to the select. Add the case to `ExpenseFormPage.test.tsx`.
- [ ] T044 [US2] Run the `docs/design.md` checklist on the Categories section and dialog (light and dark, `en` and `es`, keyboard only, focus on Cancel in the confirmation), then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint**: US1 and US2 work independently. Commit.

---

## Phase 5: User Story 3 - Give a category its own split (Priority: P3)

**Goal**: An admin ticks "Use its own split" and edits per-member weights; new expenses in that category default to those weights, while everything else follows the household.

**Independent Test**: In a household with weights 3 and 1, give one category weights 1 and 1; a €900.00 expense in it is split €450.00 / €450.00 and one in another category 75/25; changing the household's weights affects only the category without its own split.

### Tests for User Story 3 ⚠️

- [x] T045 [P] [US3] Add US3 cases to `apps/api/test/categories.test.ts` for `PUT /api/household/categories/:id/split`:
  - ADMIN with `ownSplit: true` and one weight per current membership → 200, `ownSplit: true`, `weights` in member order with `shareBps` (1/1 → 5000/5000), `version` bumped, `needsReview: false`.
  - `ownSplit: false` → weights `null`, rows deleted, `version` bumped; ticking again later starts from what the client sends.
  - Weights missing a member or with a former membership → 409 `split.members_changed`; all 0 → 400 `split.all_zero`; 101 → 400 `split.weight.invalid`; stale version → 409 `category.changed`; MEMBER/GUEST 403 `household.forbidden`; other household → 404 `category.not_found`.
  - Saving, unsaving and changing a category's weights leaves already-saved expenses identical (FR-020, SC-004).
  - A household of one can give a category its own split (weight 1), and it never reports `needsReview` (spec edge case).
- [x] T046 [P] [US3] Add US3 cases to `apps/api/test/expenses.test.ts` with `homeWith(app, { weights: [3, 1] })`: every `WEIGHTS` request carries matching `previewShares` (T016) unless stated.
  - A €900.00 `WEIGHTS` expense in a category with own weights 1/1 → 45000/45000; in a category that follows the household and with no category → 67500/22500.
  - Creating in "Rent" with `previewShares` computed from the household's 3/1 → 409 `expense.split.changed` (the preview must follow the category).
  - Editing an `EQUAL` expense in "Rent" to `WEIGHTS` with `previewShares` 45000/45000 → saved 50/50 (spec edge case "Switching…to the default split").
  - After `PUT /api/household/split` to 2/1, a following category gives the new split and the own-split category still 50/50, and earlier expenses are unchanged.
  - A member with weight 0 in the household but 1 in a category gets a share in that category, and the other way round (spec edge case).
  - A category whose own weights became all 0 (its only weighted member left) → 400 `expense.split.no_default`; amounts that don't divide evenly add up exactly (SC-003).
- [x] T047 [P] [US3] Add US3 cases to `apps/api/test/members.test.ts` (and `invitations.test.ts` if acceptance lives there): a MEMBER joining gets weight 1 and a GUEST weight 0 in every own-split category, none in following categories, and those categories report `needsReview: true` until an admin saves their split again; a member leaving or being removed loses their row in every category and the other weights stay identical.

### Implementation for User Story 3

- [x] T048 [US3] Add `updateSplit(actor, id, input)` to `apps/api/src/categories/categoryService.ts` under `lockHousehold`: lookup or 404, version check (409 `category.changed`); with `ownSplit: true`, the weights' membership ids must equal the household's current memberships exactly or 409 `split.members_changed` (reuse the household split check from `householdService.ts` if it can be extracted without behavior change); replace all `CategoryWeight` rows, set `ownSplit: true`, `splitSavedAt: now()`, bump `version`. With `ownSplit: false`, delete the rows, set `ownSplit: false`, `splitSavedAt: null`, bump `version`. Never touch expenses. Add `PUT /:id/split` with `requireAdmin` and `updateCategorySplitInputSchema` to `categoriesRouter.ts`.
- [x] T049 [US3] In `apps/api/src/expenses/expenseService.ts`, change the `WEIGHTS` branch of `computeSplit` to use `defaultWeights(currentMembers, category)` (load the category with its weights; `null` without a category) followed by `splitAmount`. Because `computeSplit` serves both create and edits that switch from `EQUAL`/`EXACT` to `WEIGHTS`, both now follow the category, and `assertPreview` (T017) compares against the category's split. All-zero or nobody → 400 `expense.split.no_default`. `WEIGHTS` → `WEIGHTS` edits without `previewShares` keep today's behavior (saved shares, rescaled).
- [x] T050 [US3] In `apps/api/src/household/invitationService.ts`, inside the accept transaction that creates the membership, insert a `CategoryWeight` with `defaultWeightFor(role)` for every category of the household with `ownSplit = true` (`createMany`). Confirm `membersChangedAt` is already bumped there so `needsReview` follows. Run `pnpm --filter @hogar/api test` (T045–T047 green).
- [x] T051 [P] [US3] Extract the weight rows from `apps/web/src/pages/HouseholdSettingsPage/SplitSection.tsx` into `apps/web/src/household/WeightsEditor.tsx` (props: members, weights by membership id, `onChange`, `disabled`, plus the labels it needs; shows name, number input 0–100 and the resulting percentage via `weightsToBasisPoints` and `Intl`). `SplitSection` uses it with no visible or behavioral change: `SplitSection.test.tsx` must pass untouched. Add `apps/web/src/household/WeightsEditor.test.tsx` (edits call `onChange`, percentages update, axe).
- [x] T052 [P] [US3] Add `updateCategorySplit(id, input)` to `apps/web/src/api/client.ts` (with a `client.test.ts` case) and its mutation to `apps/web/src/expenses/useCategories.ts` (same invalidations).
- [x] T053 [US3] Add the split controls to `apps/web/src/pages/HouseholdSettingsPage/CategoryDialog.tsx`: the `Checkbox` "Use its own split" with hint; unticked shows the household's percentages read-only; ticking shows `WeightsEditor` prefilled with a copy of the household's weights; unticking a category that has saved weights opens the `untick` confirmation (focus on Cancel). Save sends up to two requests in order, `PATCH` (only if name or emoji changed) then `PUT …/split` (only if the box or the weights changed), each with the latest `version` (use the version returned by the first). If the `PATCH` succeeds and the `PUT` fails, keep the dialog open with the new `version`, treat the name and emoji as saved (so a retry sends only the `PUT`), and show the split error. New categories are created following the household (no split controls in add mode). Show `split.*` errors as in `SplitSection`. Extend `CategoryDialog.test.tsx`: ticking prefills 3/1 and saving 1/1 sends the expected body; unticking asks for confirmation and sends `ownSplit: false`; a rename plus split change sends `PATCH` then `PUT` with the bumped version; a failed `PUT` after a successful `PATCH` keeps the dialog open and a retry sends only the `PUT`.
- [x] T054 [US3] In `CategoriesSection.tsx`, show the own-split summary "Own split: Ana 50 %, Bruno 50 %" (`settings.categories.ownSplit`, percentages from `shareBps` with `Intl`) and, for `needsReview`, a warning `Badge` with the `needsReview` text. Extend `CategoriesSection.test.tsx` for both.
- [x] T055 [US3] In `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx`, make the `WEIGHTS` option follow the category with `defaultWeights` + `splitAmount`: label "The household's split" with no category or a following one, `form.split.weightsCategory` ("{{name}}'s split") for an own-split category; the preview updates when the category changes, and the `previewShares` sent on create and when switching an `EQUAL`/`EXACT` expense to `WEIGHTS` (T018) are the category-aware ones. On 409 `expense.split.changed`, also refetch the categories. When the chosen category has its own split and every weight is 0, don't offer `WEIGHTS`, switch to another method, and show `form.split.noDefaultCategory` with a link (`form.split.reviewCategory`) to `/household#categories`. Extend `ExpenseFormPage.test.tsx`: household 3/1 and "Rent" 1/1 → choosing Rent shows "Rent's split" and €450.00 / €450.00 for €900.00; switching back to "No category" shows the household's split; editing an `EQUAL` expense in "Rent" and switching to `WEIGHTS` previews 50/50 and sends those `previewShares`; an all-zero category hides `WEIGHTS` and shows the link.
- [x] T056 [US3] Add the remaining US3 keys from [contracts/ui.md › Planned i18n keys](./contracts/ui.md#planned-i18n-keys) to `apps/web/src/i18n/locales/{en,es}/household.json` (`settings.categories.ownSplit`, `needsReview`, `dialog.ownSplit`, `dialog.ownSplitHint`, `untick.title`, `untick.description`) and `expenses.json` (`form.split.weightsCategory`, `form.split.noDefaultCategory`, `form.split.reviewCategory`).
- [ ] T057 [US3] Run the `docs/design.md` checklist on the dialog's split controls, the summaries and badge, and the form's split label (light and dark, `en` and `es`, keyboard only), then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint**: Categories can have their own split; US1–US3 all work. Commit.

---

## Phase 6: User Story 4 - Move an expense to another category (Priority: P4)

**Goal**: Changing the category of a default-split expense shows each person's share before and after and lets the person apply the new split or keep the current shares; the saved shares match the preview to the cent.

**Independent Test**: With a default-split expense, change its category to one that splits differently; the form shows before and after and both choices; applying changes shares and balances to the previewed figures; keeping changes only the category.

### Tests for User Story 4 ⚠️

- [x] T058 [P] [US4] Add US4 cases to `apps/api/test/expenses.test.ts` (household 3/1, "Rent" 1/1, a €900.00 `WEIGHTS` expense in a following category):
  - `PUT` with the new `categoryId` and `previewShares` equal to 45000/45000 → saved shares are exactly those, balances follow, `updatedBy` is the editor (Story 4 #6).
  - `PUT` with `previewShares` that don't match the current computation (e.g. the admin changed Rent to 2/1 in between) → 409 `expense.split.changed`, nothing saved (shares, category and version unchanged).
  - `PUT` with a new category and no `previewShares` → only the category changes, shares identical; with a changed amount, shares rescale as before (002 R3).
  - `previewShares` with an all-zero target category → 400 `expense.split.no_default`; moving to "no category" with `previewShares` uses the household's weights.
- [x] T059 [P] [US4] Create `apps/web/src/expenses/CategoryChangeDialog.test.tsx`: renders the title and one row per person ("Ana: €675.00 → €450.00"), "Apply Rent's split" selected by default, "Apply the household's split" when the target has no own split, only "Keep the current shares" plus the `noDefault` note when the target is all 0; confirming reports the choice; axe passes.

### Implementation for User Story 4

- [x] T060 [US4] In `apps/api/src/expenses/expenseService.ts` update: when a `WEIGHTS` → `WEIGHTS` edit carries `previewShares`, recompute with `defaultWeights(currentMembers, newCategory)` + `splitAmount` for the new amount (reuse `computeSplit`), check it with `assertPreview` (T017; 409 `expense.split.changed` on mismatch), and save the recomputed shares; all zero → 400 `expense.split.no_default`. Without `previewShares`, keep the current behavior. Run `pnpm --filter @hogar/api test` (T058 green).
- [x] T061 [US4] Create `apps/web/src/expenses/CategoryChangeDialog.tsx` per [contracts/ui.md › Category-change dialog](./contracts/ui.md#expense-form): ui `Dialog` with title `categoryChange.title`, a table of people with before → after in words and numbers (amounts with the existing money formatter), a `ChoiceGroup` (`categoryChange.legend`) with apply (category name or `applyHousehold`) selected by default and `keep`, the `noDefault` case offering only keep, an optional error message slot, and the `categoryChange.confirm` button. Props carry everything (rows, names, flags, callbacks); no data fetching inside.
- [x] T062 [US4] Wire the dialog into `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx`: when editing a `WEIGHTS` expense whose category changed, compute the new shares with `defaultWeights` + `splitAmount` for the current amount and compare them with the saved shares rescaled to the current amount; if they differ, Save opens the dialog instead of submitting; "apply" submits with `previewShares` (the previewed ones), "keep" submits without `previewShares`; if they're equal, submit without asking (FR-024). On 409 `expense.split.changed`, refetch household and categories, recompute, and reopen the dialog with the new figures and the translated error. `EQUAL` and `EXACT` never open it (FR-021). Change `form.split.weightsSaved` to the neutral text (R13): "The split when it was added ({{shares}})" / "El reparto cuando se añadió ({{shares}})".
- [x] T063 [US4] Add the `categoryChange.*` keys (`title`, `row`, `legend`, `apply`, `applyHousehold`, `keep`, `noDefault`, `confirm`) from [contracts/ui.md › Planned i18n keys](./contracts/ui.md#planned-i18n-keys) to `apps/web/src/i18n/locales/{en,es}/expenses.json`.
- [x] T064 [US4] Extend `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.test.tsx`: moving a 3/1 €900.00 expense to "Rent" 1/1 opens the dialog with €675.00 → €450.00 and €225.00 → €450.00; "apply" sends `previewShares` with 45000/45000; "keep" sends no `previewShares`; a category with the same resulting shares saves without the dialog; an `EQUAL` expense saves without the dialog; a 409 reopens the dialog with the error; the saved-split label reads "The split when it was added".
- [ ] T065 [US4] Run the `docs/design.md` checklist on the category-change dialog (light and dark, `en` and `es`, keyboard only, meaning never by color alone), then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint**: Moving expenses between categories is explicit and exact. Commit.

---

## Phase 7: User Story 5 - Find the expenses of one category (Priority: P5)

**Goal**: Anyone can filter the history by one category or by "No category"; balances ignore the filter.

**Independent Test**: With expenses in two categories and some without, filter by each and by "No category"; each view lists exactly the matching expenses, and clearing the filter shows everything again, payments included.

### Tests for User Story 5 ⚠️

- [x] T066 [P] [US5] Add US5 cases to `apps/api/test/activity.test.ts`: `?category=<id>` returns only that category's expenses, live and deleted, in the usual order and without settlements; `?category=none` returns only uncategorized expenses; an unknown id returns an empty page (200); keyset pagination with a filter across more than `ACTIVITY_PAGE_SIZE` items returns each item once; GUEST 200; a user of another household passing this household's category id gets an empty page; former member and no household 404. Add a case to `apps/api/test/balances.test.ts` that `GET /api/household/balances` ignores a `category` query param.
- [x] T067 [P] [US5] Add cases to `apps/web/src/pages/ExpensesPage/ExpensesPage.test.tsx`: the filter lists "All expenses", each category and "No category"; choosing one requests `/activity?category=<id>`, writes `?category=<id>` to the URL and shows "Showing: 🐶 Dog" with "Show everything"; loading the page with `?category=none` starts filtered; an empty filtered result shows `filter.empty` / `filter.emptyNone`; "Show everything" clears the URL param; axe passes.

### Implementation for User Story 5

- [x] T068 [US5] In `apps/api/src/expenses/ledgerService.ts` (and `ledgerRouter.ts` if it parses the query), accept `category` from `activityQuerySchema`: with an id, query only expenses with `{ householdId, categoryId: id }` (live and deleted) and skip settlements; with `"none"`, `categoryId: null`; keep the keyset cursor logic as is. Balances stay untouched. Run `pnpm --filter @hogar/api test` (T066 green).
- [x] T069 [P] [US5] Change `getActivity(cursor?, category?)` in `apps/web/src/api/client.ts` to send `category` as a query param (with a `client.test.ts` case), and include the filter in the activity query key in `apps/web/src/expenses/useExpenses.ts` so each view caches separately.
- [x] T070 [US5] Add the filter to `apps/web/src/pages/ExpensesPage/ExpensesPage.tsx` per [contracts/ui.md › Expenses page](./contracts/ui.md#expenses-page): a `Select` labeled `filter.label` above the history with "All expenses" (default), each category and "No category"; the value lives in `?category=` via `useSearchParams`; the heading area shows `filter.showing` with `CategoryLabel` and a "Show everything" button; an empty filtered list shows an `EmptyState` with `filter.empty` (category name) or `filter.emptyNone`. Add the `filter.*` keys from the planned table to `apps/web/src/i18n/locales/{en,es}/expenses.json`.
- [ ] T071 [US5] Run the `docs/design.md` checklist on the filter and empty states (light and dark, `en` and `es`, keyboard only, at 375 px), then `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.

**Checkpoint**: All five stories work independently. Commit.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end flows, docs and the final checks.

- [ ] T072 Add a `GET /api/household/categories` intercept (the five `en` starter categories) to the shared stubs used by `apps/web/cypress/e2e/expenses.cy.ts` and `household.cy.ts` (extract into `apps/web/cypress/support/` if they don't share one yet), and update their expense fixtures with `category: null`, so the existing specs stay green.
- [ ] T073 Create `apps/web/cypress/e2e/categories.cy.ts` with the flows of [quickstart.md](./quickstart.md), stubbing the API with `cy.intercept` as the other specs do and simulating the second person by changing stubbed responses mid-test (real time isn't built yet; this matches `expenses.cy.ts`):
  - Categorize: add an expense in "Groceries" and one with no category; the row shows the label only for the first (§1).
  - Manage: as ADMIN, add "🐶 Dog", rename one and delete one with the count in the confirmation; as MEMBER, the list is read-only (§2).
  - Own split: tick "Use its own split" on "Rent", set 1 and 1, save; the expense form shows "Rent's split" and €450.00 / €450.00 for €900.00 (§3).
  - Move: edit a default-split expense to "Rent", see before → after, apply and check the `PUT` body carries `previewShares`; the race (first `PUT` answered 409 `expense.split.changed`, then new figures) reopens the dialog with the message (§4).
  - Filter: choose "Dog", see only its rows, the URL param and "Showing"; reload keeps it; "Show everything" clears it (§5).
    Run `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e`.
- [ ] T074 [P] Regenerate the "Planned i18n keys" table in `specs/004-expense-categories/contracts/ui.md` from the final `apps/web/src/i18n/locales/{en,es}/*.json` (rename the heading to "i18n keys", list every new and changed key, including the 9 error codes with their final texts).
- [ ] T075 [P] Update the Status table in `README.md` with an "Expense categories" row, following the existing rows.
- [ ] T076 [P] Run the `web-design-guidelines` skill on the changed files (`CategoriesSection.tsx`, `CategoryDialog.tsx`, `CategoryChangeDialog.tsx`, `CategoryLabel.tsx`, `ExpenseFormPage.tsx`, `ExpensesPage.tsx`, `Checkbox`) and fix findings that agree with `docs/design.md`; raise any conflict instead of ignoring it.
- [ ] T077 Verify the backfill by hand per [quickstart.md › 6](./quickstart.md#6--backfill-of-existing-households-once-before-merging): restore a `pg_dump` of pre-feature local data into a scratch database, run `prisma migrate deploy` against it, and check that every household has the five starter categories in its longest-standing admin's language and that every expense has `category_id` NULL with unchanged shares. Note the result in the PR description.
- [ ] T078 Run the manual walkthrough in [quickstart.md](./quickstart.md) §1–§5 and the full design checklist (§7) in `en`/`es`, light/dark, keyboard only and with a screen reader: labels read the name without the emoji, and select options read "emoji, name" (R12).
- [ ] T079 Final gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @hogar/api build && pnpm build`, plus the Cypress suite. Everything green before opening the PR to `main`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup; **blocks every story**. Inside it: T003 → T005 → T006; T008 → T009 → T010 and T011; T012 → T014 (T013 alongside T012); T005 and T010 → T015 → T016 → T017 → T018.
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on US1 (the router, service, client and `useCategories` it extends).
- **US3 (Phase 5)**: depends on US2 (`CategoryDialog` and `CategoriesSection`) and on `defaultWeights` (T004).
- **US4 (Phase 6)**: depends on US3 (own splits are what make shares differ).
- **US5 (Phase 7)**: depends only on US1; it can run in parallel with US2–US4.
- **Polish (Phase 8)**: depends on every story.

### Within each story

- Tests first (they must fail), then API service → router → API tests green, then web client → hooks → components → page integration → i18n → design checklist and full checks.
- Tasks touching the same file run sequentially (`ExpenseFormPage.tsx`: T018 → T031 → T043 → T055 → T062; `categoryService.ts`: T023 → T037 → T048; `expenseService.ts`: T017 → T026 → T049 → T060).

### Parallel opportunities

- Phase 2: T002, T003, T004, T007 (after T003 lands it can start), T008 and T012/T013 touch different packages; T015 can be written while T016 is in progress.
- US1: T019, T020, T021 (tests); T022 with T028, T029, T030 (API view and web pieces); T032 alongside T031.
- US2: T034, T035, T036 (tests); T039 alongside T037.
- US3: T045, T046, T047 (tests); T051 and T052 alongside the API tasks T048–T050.
- US4: T058 and T059 (tests); T061 alongside T060.
- US5: T066 and T067 (tests); T069 alongside T068. The whole of US5 can run alongside US2–US4.
- Polish: T074, T075, T076.

---

## Parallel Example: User Story 1

```text
# Tests first, together:
Task: "T019 Starter set and GET permissions in apps/api/test/categories.test.ts"
Task: "T020 categoryId on create and edit in apps/api/test/expenses.test.ts"
Task: "T021 category on activity items in apps/api/test/activity.test.ts"

# Then API view and web building blocks, together:
Task: "T022 toCategoryView in apps/api/src/categories/categoryView.ts"
Task: "T028 getCategories and MSW default handler in apps/web/src/api/client.ts"
Task: "T029 useCategories in apps/web/src/expenses/useCategories.ts"
Task: "T030 CategoryLabel in apps/web/src/expenses/CategoryLabel.tsx"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 and Phase 2 (shared, data, `Checkbox`).
2. Phase 3 (US1): starter set, categorizing, labels.
3. **Stop and validate** with quickstart §1; deployable on its own.

### Incremental delivery

1. US1 → categories exist and show on expenses.
2. US2 → admins adapt the list.
3. US3 → categories with their own split.
4. US4 → moving an expense between categories is explicit.
5. US5 → the history filter (can land earlier, right after US1).
6. Polish → Cypress, docs, backfill check, final gate, one PR to `main`.

---

## Notes

- [P] tasks touch different files and don't depend on an unfinished task.
- Commit after each task or logical group with Conventional Commits in English, without AI attribution (constitution › Development Workflow).
- A task isn't done while format, lint, typecheck or tests fail.
- Never change an existing expense's shares outside an edit of that expense (Principle II); every API test that touches categories checks shares and balances, not only the category.
