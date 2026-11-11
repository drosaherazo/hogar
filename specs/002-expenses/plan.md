# Implementation Plan: Expenses with splits, balances and settling up

**Branch**: `feat/expenses` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-expenses/spec.md`

## Summary

Add the money layer of the household. Members and admins record expenses (description, amount in cents, payer, calendar date) and their split:

- **The household's split:** the current weights, frozen at save time.
- **Equally** among chosen people.
- **Exact amounts** per person.

One integer splitter in `packages/shared` (`splitAmount`, the cents version of the households leftover rule) computes every split, both in the API and in the form's live preview. Balances are never stored: the API sums expenses, shares and settlements per person and `shared` turns them into balances and a short list of suggested payments (at most `n − 1`).

Payments (settlements) are recorded the same way. Expenses and payments are editable by any editor, with a `version` guarding against overwriting someone else's change. Deleting keeps a trace: the record stops counting, and the history shows who deleted it.

Records reference users, not memberships, so people who leave stay in the history as former members, their balance keeps counting until settled, and rejoining brings it back. The API adds ten endpoints under `/api/household`. The web adds:

- An expenses page with the history.
- An expense form and an expense details page.
- A balances page with a payment dialog.
- A balance card on the home page.
- Balance-aware leave and remove dialogs.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`), Zod 4 (shared schemas), React 19, React Router 8, TanStack Query 5 (`useInfiniteQuery` for the history), react-i18next. **No new dependencies.**

**Storage**: PostgreSQL. New enum `SplitMethod` and tables `expenses`, `expense_shares`, `settlements`, with `CHECK` constraints for amounts and different people.

**Testing**: Vitest (shared, with seeded generated cases for the money rules; ui and web with Testing Library + MSW + axe), Supertest against `hogar_test` (api), Cypress with a stubbed API (web e2e).

**Target Platform**: Web (modern evergreen browsers, mobile-first at 375 px); API on Render, web on Vercel behind the same-origin `/api` rewrite.

**Project Type**: Web application (pnpm monorepo: `apps/web`, `apps/api`, `packages/ui`, `packages/shared`).

**Performance Goals**:

- Recording an everyday expense takes under 30 s (SC-001).
- Balances take a constant number of grouped queries whatever the history length.
- History pages take two indexed keyset queries each.

**Constraints**:

- Integer cents only; shares always add up to the amount; balances computed, never stored; EUR only.
- Edits refused when based on an outdated version.
- No real time (refetch on focus and after mutations).
- Every string in `en` and `es`.

**Scale/Scope**:

- Households of 2–10 people with up to a few thousand records each.
- 10 endpoints, 5 web routes plus a payment dialog, 3 new UI components plus an `Avatar` variant.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Gate                                                                                                                                                                                                                                                                                                                                                                                           | Status  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I. Small, polished, deployed   | Scope is the MVP item "expenses with splits and balances". Recurring expenses (v1.1), budgets and charts (v1.2), currencies, receipts and real time are listed as out of scope. No new packages. The extra design pieces are justified below.                                                                                                                                                  | ✅ Pass |
| II. Domain integrity           | Money is `Int` cents end to end, with no floats in logic; input is parsed from digit strings (R8). `splitAmount` gives exact sums with leftover cents to the first members (R2). Balances are computed from `ExpenseShare` and `Settlement` and never stored (R4). EUR only. The default split is by weight. Split, balance and simplification logic lives in `packages/shared`.               | ✅ Pass |
| III. Server-side security      | Every endpoint resolves the caller's membership; writes need `canEditContent` (ADMIN or MEMBER), so GUESTs get 403. Record ids are scoped to the caller's household (404). Every person id in a body is checked against current members or, where allowed, the household's history (R10, R11). No household id from the client. Bodies are validated with the shared Zod schemas.              | ✅ Pass |
| IV. Tested by default          | Unit tests for `splitAmount`, `netBalances`, `suggestSettlements` and `viewerPart`, including rounding, a single person, €0.01, zero weights, former members, and generated cases (R15). Supertest covers each endpoint × the permission matrix in `contracts/api.md`, plus versions and cascade. `ui` components get axe tests and stories. Cypress covers the five flows in `quickstart.md`. | ✅ Pass |
| V. Fully internationalized     | New `expenses` namespace plus changes to `household` and `common`, in `en` and `es`. 16 new error codes with messages (the parity test enforces them). Money via `Intl` (`formatAmount`), dates via `Intl.DateTimeFormat`. `ui` gets no copy. Planned keys are listed in `contracts/ui.md` and regenerated from the JSON at the end.                                                           | ✅ Pass |
| VI. Warm and accessible design | Balances in words, never a sign alone (FR-014). Rows carry an icon plus text. Warm, blame-free copy in both languages ("You still owe €15.00 in total…"). Delete confirmations name the record and focus Cancel. Native inputs (`ChoiceGroup`, `Select`, the date field) keep keyboard and mobile support. Checked in light and dark against `docs/design.md`.                                 | ✅ Pass |
| Constraints                    | Allowed dependencies respected: `formatAmount` lives in `ui`, so `ui` still doesn't import `shared`. CSS Modules with tokens. The Prisma migration is generated, with `CHECK`s appended. Routers live in a domain folder (`src/expenses`).                                                                                                                                                     | ✅ Pass |
| Workflow                       | Branch `feat/expenses`; spec, plan and tasks committed with the feature; Conventional Commits; PR with CI.                                                                                                                                                                                                                                                                                     | ✅ Pass |

**Post-design re-check (after Phase 1):** ✅ Still passing. Design produced one spec refinement (R3): editing the amount of a default-split expense rescales its saved shares instead of using today's weights. That strengthens FR-009 ("later weight changes don't affect existing expenses") and keeps former members in their expenses (FR-028). Nothing was relaxed.

**Post-review re-check (design review, 2026-11-11):** ✅ Still passing. The review confirmed R1–R16 and changed two things, both of which strengthen principles II and VI:

- **Deleting leaves a trace (R17):** soft delete with `deletedAt`/`deletedById`. Balances use live records only, so they stay computed and never stored.
- **Shares only change when someone edits that expense (FR-009):** editing a default-split expense shows the proportions it was recorded with.

## Project Structure

### Documentation (this feature)

```text
specs/002-expenses/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R16)
├── data-model.md        # Entities, invariants, derived views, CHECK constraints
├── quickstart.md        # How to validate end to end
├── contracts/
│   ├── api.md           # Endpoints, types, error codes, permission matrix
│   └── ui.md            # Routes, interactions, ui components, planned i18n keys
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── expenses.ts             # money/date/split schemas, expense & settlement requests and views, activity, balances
├── expenses.test.ts
├── split.ts                # + splitAmount (cents, leftover to first non-zero weights)
├── split.test.ts
├── balances.ts             # netBalances, suggestSettlements, viewerPart
├── balances.test.ts        # hand-picked + seeded generated cases
├── permissions.ts          # + canEditContent
├── errors.ts               # + 15 error codes
└── index.ts                # re-exports

apps/api/
├── prisma/schema.prisma    # SplitMethod, Expense, ExpenseShare, Settlement (+ back-relations)
├── prisma/migrations/<ts>_expenses/migration.sql   # generated + CHECK constraints
├── src/expenses/
│   ├── people.ts               # current members in order, people in history, PersonRef
│   ├── expenseService.ts       # get/create/update/delete, shares, versions, household lock
│   ├── settlementService.ts    # get/create/update/delete, versions
│   ├── ledgerService.ts        # activity (keyset merge) and balances (grouped sums)
│   ├── expensesRouter.ts       # /api/household/expenses
│   ├── settlementsRouter.ts    # /api/household/settlements
│   └── ledgerRouter.ts         # /api/household/activity, /api/household/balances
├── src/household/loadMembership.ts   # + requireEditor
├── src/app.ts                  # mount the three routers before /api/household
└── test/
    ├── testApp.ts              # truncate the new tables
    ├── expenseHelpers.ts       # seed households, add expenses and settlements through the API
    ├── expenses.test.ts
    ├── settlements.test.ts
    ├── balances.test.ts
    ├── activity.test.ts
    └── members.test.ts         # + last member leaving deletes expenses and settlements

packages/ui/src/components/
├── Amount/        (tsx, module.css, test, stories, mdx)   # + formatAmount
├── ChoiceGroup/   (tsx, module.css, test, stories, mdx)
├── Select/        (tsx, module.css, test, stories, mdx)
└── Avatar/        # + muted variant (story, test, docs)

apps/web/src/
├── api/client.ts                 # activity, balances, expense and settlement methods
├── expenses/
│   ├── money.ts (+ test)         # parseAmount
│   ├── useExpenses.ts            # queries (activity infinite, balances, records) and mutations
│   ├── people.ts                 # PersonRef → avatar color by member order, or muted
│   ├── BalanceSentence.tsx       # the viewer's one-sentence balance (home, expenses, dialogs)
│   ├── ActivityList.tsx          # month groups, rows, show more
│   └── PaymentDialog.tsx         # record / view / edit a payment
├── pages/ExpensesPage/
├── pages/ExpenseFormPage/        # create and edit
├── pages/ExpenseDetailPage/
├── pages/BalancesPage/
├── pages/HomePage/               # + balance card
├── pages/HouseholdSettingsPage/  # MembersSection balance-aware dialogs; InvitationsSection → ChoiceGroup
├── layout/AppShell.tsx           # + primary navigation
├── i18n/locales/{en,es}/expenses.json (new), household.json, common.json, errors.json
├── i18n/resources.ts             # register the expenses namespace
└── App.tsx                       # /expenses, /expenses/new, /expenses/:id, /expenses/:id/edit, /balances

apps/web/cypress/e2e/expenses.cy.ts
```

**Structure Decision**: Follow the existing monorepo layout and the households patterns. The API gets a new domain folder, `src/expenses`, whose routers mount under the singular `/api/household`, like invitations. Web pages each get a folder with tsx, CSS module and test. Expense-specific hooks and shared pieces live in `apps/web/src/expenses/`. Reusable visuals go to `packages/ui`.

## Delivery order (each slice is shippable and tested)

1. **Shared:** schemas, 15 error codes (plus `en`/`es` messages), `splitAmount`, `netBalances`, `suggestSettlements`, `viewerPart`, `canEditContent`.
2. **Data:** Prisma models, migration with `CHECK`s, test truncation.
3. **UI components:** `Amount`, `ChoiceGroup` (and migrate the invitation role picker), `Select`, `Avatar` muted.
4. **US1 · Record an expense:** `POST`/`GET` expense with the household split, `GET activity`, the expenses page, the form (household split), the details page, navigation.
5. **US2 · Balances:** `GET balances`, the balances page, the home card.
6. **US3 · Settle up:** settlements `POST`/`GET`, the payment dialog, payment rows in the history.
7. **US4 · Other splits:** `EQUAL` and `EXACT` in the API and the form.
8. **US5 · Fix mistakes:** `PUT` and soft `DELETE` with versions for expenses and settlements, the edit form ("when it was added" label), delete dialogs, "changed by", muted "deleted by" lines in the history.
9. **US6 · People move out:** former member flags, payments with former members, balance-aware leave and remove dialogs, last-member copy, cascade tests.
10. **E2E and polish:** Cypress flows, the design checklist, the i18n key table regenerated from JSON, README status row.

## Complexity Tracking

No constitution violations. Four design pieces go beyond the simplest CRUD; each is required by the spec:

| Addition                                     | Why needed                                                                                                               | Simpler alternative rejected because                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `version` column on expenses and settlements | FR-024: an edit based on an outdated version must be refused, not overwrite someone else's change                        | Last write wins breaks FR-024; timestamps collide and couple to clocks                                              |
| Soft delete (`deletedAt`, `deletedById`)     | FR-025 (design review): any editor can delete any record, so deletions must leave a visible trace                        | A hard delete is the one change that would leave no trace; an audit log table is a new layer for one event          |
| Keyset-paginated history merging two tables  | FR-003/FR-021: one history of expenses and payments, unbounded over time, stable while people add records                | Loading everything grows without limit; offsets skip or repeat rows when records are added                          |
| `ChoiceGroup` and `Select` in `packages/ui`  | Split method, people, payer and payment selects need them, and the invitation role picker already duplicates the pattern | Keeping local copies in the web duplicates markup and styles, which households R11 deferred until a second consumer |
