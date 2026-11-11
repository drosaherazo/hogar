# Implementation Plan: Expense categories with their own split

**Branch**: `feat/expense-categories` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-expense-categories/spec.md`

## Summary

Every household gets a list of expense categories (a name and an optional emoji). Each household starts with a starter set of five, and admins add, rename and delete categories. An expense may have one category or none.

A category either follows the household's split or, when an admin ticks "use its own split", has its own integer weight (0–100) per member. That weight replaces the household's weights as the default split for its expenses.

One shared function, `defaultWeights`, decides which weights apply, and the existing `splitAmount` turns them into cents. Both live in `packages/shared`, so the form's preview and the saved shares are computed the same way.

Shares stay fixed once saved:

- **Weights and deleted categories**: changing a category's weights, or deleting a category, never touches an existing expense.
- **Moving an expense to another category**: the edit form shows each person's share before and after. Applying the new split sends the previewed shares (`reapply`), and the API saves them only if it computes exactly the same.

The history can be filtered by category, and balances ignore the filter.

The work adds:

- **Database**: two tables (`expense_categories`, `category_weights`), a nullable `expenses.category_id`, and a migration that backfills the starter set for existing households.
- **API**: five category endpoints, plus small changes to the expense, activity, household-create and invitation-accept flows.
- **Web**: a Categories section in the household settings, a category select and change dialog in the expense form, and a filter on the expenses page.
- **UI**: a new `Checkbox` in `packages/ui`.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`), Zod 4 (shared schemas), React 19, React Router 8, TanStack Query 5, react-i18next. **No new dependencies** (`Intl.Segmenter` for emoji validation is built in).

**Storage**: PostgreSQL. New tables `expense_categories` and `category_weights`, plus `expenses.category_id` (`ON DELETE SET NULL`). SQL appended to the migration: a `CHECK` on weight 0–100, a unique `(household_id, lower(name))` index, and the starter-set backfill (see [data-model.md](data-model.md)).

**Testing**: Vitest (shared and ui, plus web with Testing Library, MSW and axe), Supertest against `hogar_test` (api), Cypress with a stubbed API (web e2e).

**Target Platform**: Web (evergreen browsers, mobile-first at 375 px); API on Render, web on Vercel behind the same-origin `/api` rewrite.

**Project Type**: Web application (pnpm monorepo: `apps/web`, `apps/api`, `packages/ui`, `packages/shared`).

**Performance Goals**:

- Recording an expense with a category takes under 30 s, and without one it takes no longer than today (SC-001).
- An admin gives a category its own split in under one minute (SC-002).
- `GET /categories` is two queries: categories with weights, plus a grouped count of expenses.
- A filtered history page stays one indexed keyset query.

**Constraints**:

- Integer cents only; shares add up exactly; shares never change outside an edit of that expense.
- Only admins manage categories and their split.
- Edits based on an outdated version are refused.
- No real time: data refetches on focus and after mutations.
- Every string is in `en` and `es`.

**Scale/Scope**:

- Households of 2–10 people, at most 30 categories each.
- 5 new endpoints and 4 changed flows.
- 4 changed pages, 3 new web components and 1 new ui component.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Checked against constitution **v3.1.0** (amended in PR #23 for this feature; this branch is based on it until it merges).

| Principle                        | Gate                                                                                                                                                                                                                                                                                                                                                                                                                            | Status  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I. Small, polished, deployed     | Within the MVP item "expense categories (with an optional own split and a list filter)", added in v3.1.0. Charts and totals per category, archiving, sub-categories and colors are out of scope (spec Assumptions). No new packages. Design pieces beyond plain CRUD are justified in Complexity Tracking.                                                                                                                      | ✅ Pass |
| II. Domain integrity             | Cents stay `Int`, and every split still goes through `splitAmount` (exact sum, leftover cents to the first members). Balances are untouched and computed. The new rule "Category splits extend the default" is implemented by `defaultWeights` in `packages/shared` (R2). "Shares are fixed when saved" is kept: `SET NULL` on delete, no recalculation on weight changes, and `reapply` only inside a previewed edit (R1, R3). | ✅ Pass |
| III. Server-side security        | Category writes use `requireAdmin` and reads any membership (R10). Category ids are scoped to the caller's household (404 on writes, 400 `expense.category.not_found` on expenses). Weight lists must match the current memberships exactly. Bodies are validated with the shared Zod schemas. No household id comes from the client.                                                                                           | ✅ Pass |
| IV. Tested by default            | Unit tests for `defaultWeights`, the name and emoji schemas, and starter-set parity with the migration SQL. Supertest for every cell of the permission matrix in `contracts/api.md`, plus versions, the limit, uniqueness, cascades, `reapply` and the filter. `Checkbox` gets test, axe and story. Cypress covers the flows in `quickstart.md`.                                                                                | ✅ Pass |
| V. Fully internationalized       | New keys in `household`, `expenses` and `errors` (planned in `contracts/ui.md`), with 9 new error codes. The API returns codes only. Starter names are created in `User.locale` (R4), as the constitution allows for server-produced text. Category names people type are data and are shown as typed. Money and percentages use `Intl`.                                                                                        | ✅ Pass |
| VI. Joyful and accessible design | Emoji plus name in a neutral badge, with no color per category and the emoji `aria-hidden` (R12). The review notice is a text badge. The money-moving choice is explicit, with a before/after table in words (Story 4). Delete and untick confirmations state their consequences, and focus starts on Cancel. Native checkbox (R11). The `docs/design.md` checklist runs on every changed screen.                               | ✅ Pass |
| Constraints                      | Allowed dependencies respected: `Checkbox` lives in `ui` with no copy, and `defaultWeights` and the schemas live in `shared`. CSS Modules with tokens. Prisma migration generated, with SQL appended. API code goes in a new domain folder, `src/categories`.                                                                                                                                                                   | ✅ Pass |
| Workflow                         | Branch `feat/expense-categories`; the constitution was amended first in its own PR (#23) with ADR 0005; spec, plan and tasks are committed with the feature; Conventional Commits; PR with CI.                                                                                                                                                                                                                                  | ✅ Pass |

**Post-design re-check (after Phase 1):** ✅ Still passing. Design added two refinements, and both strengthen Principle II:

- **`reapply` carries the previewed shares (R3)**: a concurrent weight change can't save shares the person never saw.
- **The saved-proportions label becomes neutral (R13)**: after "keep the current shares", the label no longer claims the proportions came from the category.

Nothing was relaxed.

## Project Structure

### Documentation (this feature)

```text
specs/004-expense-categories/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R14)
├── data-model.md        # Tables, invariants, migration SQL, derived views, state transitions
├── quickstart.md        # How to validate end to end
├── contracts/
│   ├── api.md           # Endpoints, types, changed flows, error codes, permission matrix
│   └── ui.md            # Screens, interactions, the Checkbox component, planned i18n keys
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── categories.ts            # name/emoji schemas, CategoryRef/CategoryView, requests, STARTER_CATEGORIES
├── categories.test.ts       # graphemes (flags, skin tones, ZWJ), names, starter parity with migration SQL
├── split.ts                 # + defaultWeights(members, category)
├── split.test.ts            # + defaultWeights cases
├── expenses.ts              # + categoryId on input, WEIGHTS.reapply, category on views, activity `category` query
├── expenses.test.ts
├── errors.ts                # + 9 error codes
└── index.ts                 # re-exports

apps/api/
├── prisma/schema.prisma     # ExpenseCategory, CategoryWeight, Expense.categoryId (+ back-relations)
├── prisma/migrations/<ts>_expense_categories/migration.sql   # generated + CHECK, lower(name) index, backfill
├── src/categories/
│   ├── categoryService.ts   # list/create/rename/updateSplit/remove, household lock, versions, limit
│   ├── categoryView.ts      # CategoryView (shareBps, needsReview, expenseCount)
│   └── categoriesRouter.ts  # /api/household/categories
├── src/expenses/expenseService.ts   # categoryId check, defaultWeights for WEIGHTS, reapply + 409
├── src/expenses/ledgerService.ts    # category on activity items, `category` filter
├── src/household/householdService.ts   # create seeds STARTER_CATEGORIES in User.locale
├── src/household/invitationService.ts  # accept adds category weights
├── src/app.ts               # mount categories router before /api/household
└── test/
    ├── testApp.ts           # truncate the new tables
    ├── categories.test.ts   # CRUD, split, permissions, versions, limit, uniqueness, starter set
    ├── expenses.test.ts     # + category on create/edit, defaultWeights by category, reapply, delete → NULL
    ├── activity.test.ts     # + filter
    └── members.test.ts      # + join adds weights / notice, leave cascades

packages/ui/src/components/
└── Checkbox/   (tsx, module.css, test, stories, mdx)

apps/web/src/
├── api/client.ts                          # category methods, activity `category` param
├── household/WeightsEditor.tsx (+ test)   # extracted from SplitSection
├── expenses/
│   ├── useCategories.ts                   # query + mutations
│   ├── CategoryLabel.tsx (+ test)         # emoji (aria-hidden) + name in a Badge
│   ├── CategoryChangeDialog.tsx (+ test)  # before/after, apply or keep
│   └── ActivityList.tsx                   # + category label on rows
├── pages/HouseholdSettingsPage/
│   ├── CategoriesSection.tsx (+ test)
│   ├── CategoryDialog.tsx (+ test)        # name, emoji, Checkbox, WeightsEditor, delete
│   └── SplitSection.tsx                   # uses WeightsEditor
├── pages/ExpenseFormPage/                 # category Select, split label/preview by category, dialog
├── pages/ExpensesPage/                    # filter (URL param), empty filtered state
├── pages/ExpenseDetailPage/               # category label
└── i18n/locales/{en,es}/household.json, expenses.json, errors.json

apps/web/cypress/e2e/categories.cy.ts
```

**Structure Decision**: Follow the existing monorepo layout and the patterns of the households and expenses features:

- **API**: a new domain folder, `src/categories`, whose router mounts under the singular `/api/household` like invitations and expenses.
- **Web**: category pieces that belong to expenses live in `apps/web/src/expenses/`, and the settings pieces next to the other settings sections. The shared weight editor moves to `apps/web/src/household/`.
- **UI**: only the generic `Checkbox` goes to `packages/ui`.

## Delivery order (each slice is shippable and tested)

1. **Shared**: category schemas, `STARTER_CATEGORIES`, `defaultWeights`, expense schema changes, 9 error codes with `en`/`es` messages.
2. **Data**: Prisma models, migration with `CHECK`, index and backfill; test truncation; backfill checked by hand (quickstart §6).
3. **UI component**: `Checkbox`.
4. **US1 · Categorize**: starter set on household create; `GET /categories`; `categoryId` on expense create and edit; category on views and activity; form select; labels on rows and details.
5. **US2 · Manage**: `POST`/`PATCH`/`DELETE` categories with versions, limit and uniqueness; Categories section and dialog (name and emoji); delete confirmation with the count.
6. **US3 · Own split**: `PUT …/split`; `defaultWeights` in create; join adds weights; `needsReview`; `WeightsEditor` extraction; the box, editor and untick confirmation; form split label and preview by category; all-zero category handling.
7. **US4 · Move between categories**: `reapply` with the 409 check; `CategoryChangeDialog`; neutral "when it was added" label.
8. **US5 · Filter**: activity `category` query; filter select bound to the URL; empty filtered states.
9. **E2E and polish**: Cypress flows, the design checklist, the i18n key table regenerated from JSON, README status row.

## Complexity Tracking

No constitution violations. Four design pieces go beyond the simplest CRUD; each is required by the spec:

| Addition                                                       | Why needed                                                                                                                 | Simpler alternative rejected because                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CategoryWeight` table keyed by membership                     | FR-013, FR-018, FR-019: per-member weights that follow people joining and leaving without leaving stale data               | A JSON column can't cascade on leave or enforce 0–100 per entry; keying by user leaves weights for former members                      |
| `reapply` with the previewed shares on `PUT` (409 on mismatch) | FR-022–FR-024 and SC-005: one edit, two outcomes chosen by the person, and saved shares must match the preview to the cent | Always recomputing breaks "keep the shares"; sending `EXACT` loses rescaling on later amount fixes; a version can't see weight changes |
| Starter-set backfill inside the migration                      | FR-002: existing households receive the set exactly once, in a sensible language                                           | A separate script can be forgotten on deploy; lazy creation on read is a hidden write with races                                       |
| `Checkbox` in `packages/ui`                                    | FR-011: the spec and the user name a single box, and `ui` has no checkbox component                                        | A local checkbox in the web skips the axe test, story and docs the constitution requires; `ChoiceGroup` turns one box into two radios  |
