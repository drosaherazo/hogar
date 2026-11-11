# Tasks: Expenses with splits, balances and settling up

**Input**: Design documents from `specs/002-expenses/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: Required. Constitution principle IV calls for:

- Unit tests for the money logic (rounding, single person, zero amounts, removed members).
- Supertest for every endpoint, including GUEST, former-member and other-household cases.
- A test plus story for every ui component.
- Cypress for the main flows.

Within each story, test tasks come first and must fail before implementation.

**Organization**: Tasks are grouped by user story so each one can be implemented, tested and demoed on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US6 from spec.md
- Paths are relative to the repository root

## Path Conventions

- Shared: `packages/shared/src/` · API: `apps/api/src/`, tests in `apps/api/test/` · UI: `packages/ui/src/components/<Name>/` · Web: `apps/web/src/` · E2E: `apps/web/cypress/e2e/`
- UI component folders follow `packages/ui/src/components/Button/` (tsx, module.css, test with axe, stories, bilingual mdx)
- API services take the injected clock (`now`) like `householdService`; errors use the helpers in `apps/api/src/httpError.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and the new i18n namespace.

- [x] T001 Confirm the baseline: Docker Desktop running and Postgres up (`pnpm db:up`), `pnpm typecheck` and `pnpm test` green on `feat/expenses` before any change
- [x] T002 [P] Add the `expenses` i18n namespace: create `apps/web/src/i18n/locales/en/expenses.json` and `apps/web/src/i18n/locales/es/expenses.json` (empty objects for now) and register them in `apps/web/src/i18n/resources.ts` so keys are typed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Money logic, schemas, data model, request plumbing and UI building blocks that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared money logic (tests first)

- [x] T003 [P] Write unit tests for `splitAmount` in `packages/shared/src/split.test.ts`:
  - The result always sums to the amount.
  - Splits: `(4280, [3, 1])` → `[3210, 1070]`; `(1001, [3, 1])` → `[751, 250]`; `(1000, [1, 1, 1])` → `[334, 333, 333]`; `(2, [1, 1, 1])` → `[1, 1, 0]`.
  - A zero weight gets 0 and never a leftover: `(1001, [0, 3, 1])` → `[0, 751, 250]`.
  - A single entry gets everything.
  - Rescaling stored shares: `(4400, [3210, 1070])` → `[3300, 1100]`.
  - Large values stay exact: `(10000000, [10000000, 1])`.
  - Throws on an empty list, all-zero weights, or an amount that isn't a positive integer.
- [x] T004 [P] Write unit tests for `netBalances`, `suggestSettlements` and `viewerPart` in `packages/shared/src/balances.test.ts`:
  - **netBalances:** `balance = paid − owed + sent − received`.
  - **Spec example:** Ana paid 2000 for Bruno only, Bruno paid 2000 for Carla only → Bruno 0 and a single suggestion Carla → Ana 2000.
  - **Suggestions:** at most `n − 1` for `n` non-zero balances; debtors only pay and creditors only receive; ties follow the input order; all-zero → `[]`.
  - **viewerPart:** `owes` (share when someone else paid), `lent` (amount − share when the viewer paid; `none` if that is 0) and `none` (not involved).
  - **Generated cases (research R15):** a seeded loop of ≥ 300 generated households with expenses and settlements. Each must have shares summing to the amount, balances summing to 0, applying every suggestion leaving everyone at 0, at most `n − 1` suggestions, and identical output for identical input. Write the seeded generator in the test file; no new dependency.
- [x] T005 [P] Add tests for `canEditContent(role)` in `packages/shared/src/permissions.test.ts`: true for `ADMIN` and `MEMBER`, false for `GUEST`
- [x] T006 [P] Implement `splitAmount(amountCents: number, weights: readonly number[]): number[]` in `packages/shared/src/split.ts` (research R2):
  - Integer math only: each share is `floor(amount × w / Σw)`.
  - Leftover cents go one each to the first entries with a weight above 0, in the order given.
  - Throws on an empty list, `Σw = 0` or a non-positive or non-integer amount.
  - Document it as the cents version of `weightsToBasisPoints`.
- [x] T007 [P] Implement `packages/shared/src/balances.ts` (research R4, R5, R9):
  - `netBalances({ paid, owed, sent, received }: Record<"paid" | "owed" | "sent" | "received", ReadonlyMap<string, number>>): Map<string, number>`.
  - `suggestSettlements(balances: readonly { userId: string; balanceCents: number }[]): { fromUserId: string; toUserId: string; amountCents: number }[]`: greedy, the largest debtor pays the largest creditor, ties by input order.
  - `viewerPart(expense: { paidById: string; amountCents: number; shares: readonly { userId: string; amountCents: number }[] }, viewerId: string): { kind: "owes" | "lent" | "none"; amountCents: number }`.
- [x] T008 [P] Implement `canEditContent(role: Role): boolean` in `packages/shared/src/permissions.ts` (ADMIN or MEMBER: the constitution's "create and edit content")

### Shared schemas and error codes

- [x] T009 Write schema tests in `packages/shared/src/expenses.test.ts`:
  - **Description:** trimmed and 1–100 characters (`expense.description.required` when empty or only spaces, `expense.description.too_long` at 101).
  - **Amount:** `amountCents` an integer from 1 to 10,000,000 (`money.amount.invalid` for 0, −1, 1.5 and 10000001).
  - **Date:** `YYYY-MM-DD` (`money.date.invalid` for `2026-13-01` and `11/11/2026`).
  - **EQUAL:** needs ≥ 1 unique `userIds` (`expense.split.invalid` for empty or duplicates).
  - **EXACT:** needs ≥ 1 unique `userId` with integer amounts from 0 to 10,000,000, summing to `amountCents` (`expense.split.mismatch`).
  - **Settlements:** `fromUserId` ≠ `toUserId` (`settlement.same_person`).
  - **Updates:** require an integer `version` ≥ 1.
  - **Activity query:** `limit` from 1 to 50, default 30.
- [x] T010 Implement `packages/shared/src/expenses.ts` per `contracts/api.md` › Types. Zod issues carry error codes as messages, not sentences, as in `household.ts`.
  - **Constants:** `MAX_AMOUNT_CENTS = 10_000_000`, `EXPENSE_DESCRIPTION_MAX = 100`, `ACTIVITY_PAGE_SIZE = 30`.
  - **Base schemas:** `splitMethodSchema` (`WEIGHTS` | `EQUAL` | `EXACT`), `moneyCentsSchema`, `calendarDateSchema`, `expenseDescriptionSchema`.
  - **Requests:** `expenseSplitInputSchema` (discriminated by `method`), `expenseInputSchema` (with the EXACT sum refinement), `updateExpenseInputSchema`, `settlementInputSchema`, `updateSettlementInputSchema`, `activityQuerySchema`.
  - **Responses:** `personRefSchema`, `deletionSchema`, `expenseViewSchema`, `settlementViewSchema`, `activityItemSchema`, `activityPageSchema`, `personBalanceSchema`, `suggestedSettlementSchema`, `balancesViewSchema`, `expenseResponseSchema` (`{ expense }`), `settlementResponseSchema` (`{ settlement }`).
- [x] T011 Add the 16 new codes (the 15 planned plus `household.read_only`, found during implementation) from `contracts/api.md` › New error codes to `ERROR_CODES` in `packages/shared/src/errors.ts`, and export `expenses` and `balances` from `packages/shared/src/index.ts`
- [x] T012 Add the `en` and `es` messages for the 15 codes to `apps/web/src/i18n/locales/en/errors.json` and `apps/web/src/i18n/locales/es/errors.json`, copied from `contracts/ui.md` › `errors` namespace, and confirm `apps/web/src/i18n/i18n.test.ts` passes

### Data model

- [x] T013 Add to `apps/api/prisma/schema.prisma` per `data-model.md`, with snake_case `@map`/`@@map` everywhere:
  - **`enum SplitMethod { WEIGHTS EQUAL EXACT }`.**
  - **`Expense` (`@@map("expenses")`):**
    - `householdId` FK `onDelete: Cascade`; `description String`.
    - `amountCents Int` ("1 – 10,000,000 (€0.01 – €100,000.00)"); `date DateTime @db.Date`.
    - `paidById` FK → User `onDelete: Restrict`; `splitMethod SplitMethod`.
    - `createdById` FK `onDelete: Restrict`; `createdAt @default(now())`.
    - `editedById String?` FK; `editedAt DateTime?`; `version Int @default(1)`.
    - `deletedById String?` FK `onDelete: Restrict`; `deletedAt DateTime?`.
    - Indexes `(householdId, date(sort: Desc), createdAt(sort: Desc), id(sort: Desc))` and `(householdId, paidById)`.
  - **`ExpenseShare` (`@@map("expense_shares")`):** `expenseId` FK `onDelete: Cascade`, `userId` FK `onDelete: Restrict`, `amountCents Int` ("≥ 0"), `@@id([expenseId, userId])`, `@@index([userId])`.
  - **`Settlement` (`@@map("settlements")`):** `householdId` FK cascade, `fromUserId` and `toUserId` FKs `onDelete: Restrict`, `amountCents`, `date @db.Date`, then the same created, edited, version and deleted columns as `Expense`. Indexes `(householdId, date desc, createdAt desc, id desc)`, `(householdId, fromUserId)` and `(householdId, toUserId)`.
  - **Back-relations:** on `Household` (`expenses`, `settlements`) and named relations on `User` for every FK.
- [x] T014 Generate the migration with `pnpm --filter @hogar/api exec prisma migrate dev --name expenses`. Append the four `CHECK` constraints from `data-model.md` › Constraints verbatim to the generated `apps/api/prisma/migrations/<timestamp>_expenses/migration.sql`: `expenses_amount_range`, `expense_shares_amount_nonnegative`, `settlements_amount_range`, `settlements_different_people`. Run `prisma migrate reset --force` locally to verify it applies cleanly.
- [x] T015 Update `apps/api/test/testApp.ts` to add `"expense_shares", "expenses", "settlements"` to the `TRUNCATE … CASCADE` statement. Create `apps/api/test/expenseHelpers.ts` with:
  - `homeWith(app, { weights? })`: Ana ADMIN plus Bruno MEMBER (and optionally Carla GUEST) through `addMember`, with weights set directly.
  - `addExpense(app, who, input)` and `addSettlement(app, who, input)`, which assert 201 and parse with the shared schemas.
  - `balancesOf(app, who)`.

### Request plumbing

- [x] T016 Add a `requireEditor` middleware to `apps/api/src/household/loadMembership.ts` that throws 403 `household.forbidden` unless `canEditContent(req.membership.role)`
- [x] T017 Implement `apps/api/src/expenses/people.ts` (research R1, R11):
  - `currentMembers(tx, householdId)`: ordered by `joinedAt`, then `id`, with user id, name, avatar and weight.
  - `isInHistory(tx, householdId, userId)`: whether the person is a payer, share user or settlement party of a **live** record (three indexed counts instead of loading the whole set).
  - `personRefs(tx, householdId, userIds)`: `Map<userId, PersonRef>` with `former = !currentMember`.
  - `orderPeople(refs, members)`: current members in member order, then former members by name, then id.

### UI building blocks (tests first)

- [x] T018 [P] `Amount` tests in `packages/ui/src/components/Amount/Amount.test.tsx`:
  - Renders 4280 as the `Intl` EUR format for `en` ("€42.80") and `es` ("42,80 €"), via `LocaleProvider`.
  - `formatAmount(cents, locale)` returns the same strings.
  - Uses tabular numbers; axe has no violations.
- [x] T019 [P] `ChoiceGroup` tests in `packages/ui/src/components/ChoiceGroup/ChoiceGroup.test.tsx`:
  - **Single choice:** native radios in a `fieldset` named by its `legend`; `onChange(value)`.
  - **Multiple:** checkboxes; `onChange(values)`.
  - **Option hints:** linked with `aria-describedby`.
  - **Disabled options:** stay readable, with their hint.
  - axe has no violations.
- [x] T020 [P] `Select` tests in `packages/ui/src/components/Select/Select.test.tsx`: label linked to the native select; hint and error linked with `aria-describedby`; `aria-invalid` with an error; options and `onChange`; axe has no violations
- [x] T021 [P] Add `Avatar` `muted` tests to `packages/ui/src/components/Avatar/Avatar.test.tsx`: the muted variant uses the neutral style, keeps its accessible name, and passes axe
- [x] T022 [P] Build `packages/ui/src/components/Amount/` (Amount.tsx with a `cents` prop reading the locale from `useLocale()`, module.css with `font-variant-numeric: tabular-nums`, stories, bilingual Amount.mdx) and export `Amount` and `formatAmount` from `packages/ui/src/index.ts`
- [x] T023 [P] Build `packages/ui/src/components/ChoiceGroup/` (props `legend`, `options: { value, label, hint?, disabled? }[]`, `value`/`onChange`, `multiple?`; styles moved from `.fieldset`, `.legend`, `.choice`, `.radio` and `.choiceText` in `apps/web/src/pages/HouseholdSettingsPage/HouseholdSettingsPage.module.css`; tokens only; stories; bilingual mdx) and export it from `packages/ui/src/index.ts`
- [x] T024 [P] Build `packages/ui/src/components/Select/` (mirrors `TextField`: `label` required, `hint`, `error`, `options`, 44 px tall via `--size-touch`, tokens only, stories, bilingual mdx) and export it from `packages/ui/src/index.ts`
- [x] T025 [P] Add the `muted` variant to `packages/ui/src/components/Avatar/Avatar.tsx` and `Avatar.module.css` (neutral sand fill from semantic tokens), with a story and a bilingual note in `Avatar.mdx` ("people who are no longer members")
- [x] T026 Move the invitation role picker in `apps/web/src/pages/HouseholdSettingsPage/InvitationsSection.tsx` to `ChoiceGroup`, delete the now-unused classes from `HouseholdSettingsPage.module.css`, and keep `InvitationsSection.test.tsx` passing

### Web plumbing

- [x] T027 [P] Write `parseAmount` tests in `apps/web/src/expenses/money.test.ts`:
  - Accepted: `"42.80"` and `"42,80"` → 4280; `"42"` → 4200; `"0,5"` → 50; `" 12,50 "` → 1250; `"100000"` → 10000000.
  - Refused (`null`): `"1.200"`, `"1,234.56"`, `"12.345"`, `""`, `"-3"` and `"abc"`.
  - No floating point is involved: `"0.29"` → 29.
- [x] T028 [P] Implement `parseAmount(text: string): number | null` in `apps/web/src/expenses/money.ts`. It accepts digits with an optional `,` or `.` followed by one or two digits, refuses thousands separators, and builds cents from the digit strings (research R8).
- [x] T029 [P] Implement `apps/web/src/expenses/people.ts`: `avatarPropsFor(person: PersonRef, members: MemberView[])` returns `colorIndex` from `memberColor` (member order) for current members, or `muted` for former members

**Checkpoint**: shared tests green (including generated cases), migration applied, ui components tested, typecheck green. Stories can start.

---

## Phase 3: User Story 1 - Record a shared expense (Priority: P1) 🎯 MVP

**Goal**: Members and admins record an expense with the household's split; everyone sees it at the top of the history with their own part, and can open its details.

**Independent Test**: In a household with two members and weights 3 and 1, add an expense as a member and check that it appears for both with the right payer, amount, date and shares, and that each person sees their own part.

### Tests for User Story 1 ⚠️

- [x] T030 [P] [US1] Supertest suite `apps/api/test/expenses.test.ts` (create and read):
  - **Create:** `POST /api/household/expenses` as ADMIN and as MEMBER with `{ method: "WEIGHTS" }` → 201. Weights 3/1 give 4280 → 3210/1070 and 1001 → 751/250; only members with weight > 0 get a stored share; the response is an `ExpenseView` with `createdBy`.
  - **Validation:** a description that is empty, only spaces or 101 characters; an amount of 0, −1, 1.5 or 10000001; date `2026-13-01`; a date after the server's UTC date + 1 day → `money.date.future` (UTC date + 1 is accepted).
  - **People:** `paidById` not a current member → 400 `expense.person.not_member`; every weight 0 → 400 `expense.split.no_default`.
  - **Permissions:** GUEST → 403 `household.forbidden`; no household → 404 `household.not_member`.
  - **Read:** `GET /api/household/expenses/:id` as GUEST → 200; an id from another household → 404 `expense.not_found`.
  - **Frozen shares:** after an admin changes the weights, the saved shares are unchanged.
- [x] T031 [P] [US1] Supertest suite `apps/api/test/activity.test.ts`:
  - **Order:** `GET /api/household/activity` sorts by `date desc, createdAt desc, id desc`.
  - **Viewer's part:** `owes`, `lent` or `none` for the caller.
  - **Paging:** with `limit=2` over 5 records, there are no duplicates or gaps, even with a record added between pages; `nextCursor` is null at the end; a garbage cursor → 400 `request.invalid`.
  - **Access:** a GUEST can read; another household's records never appear; no household → 404.
- [x] T032 [P] [US1] Web tests with MSW handlers in `apps/web/src/test/server.ts`:
  - **`apps/web/src/pages/ExpensesPage/ExpensesPage.test.tsx`:** the empty state; month groups; rows with icon, text, amount and viewer's part; **Show more** loads the next page; **Add expense** hidden for a GUEST; axe.
  - **`apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.test.tsx`** (create):
    - Defaults: payer = me, date = local today with that `max`, the household split with a live share preview.
    - In `es`, typing `42,80` saves 4280.
    - Inline errors come from codes.
    - When every weight is 0, the household split is disabled with the note and a link to `/household/settings#split`.
    - Success navigates to the details page with "Expense saved."
  - **`apps/web/src/pages/ExpenseDetailPage/ExpenseDetailPage.test.tsx`:** amount, description, date, payer, shares with avatars, "Added by"; axe.

### Implementation for User Story 1

- [x] T033 [US1] Implement `get` and `create` in `apps/api/src/expenses/expenseService.ts`:
  - **Create** runs in one transaction under `lockHousehold`. It checks that `paidById` is a current member and rejects dates later than the clock's UTC date + 1 day (`money.date.future`).
  - **WEIGHTS** uses `splitAmount` over the current weights in member order (all zero → `expense.split.no_default`) and stores shares > 0.
  - **Responses:** both return an `ExpenseView` built with `personRefs`, shares in `orderPeople` order.
  - **Get** is scoped to the caller's household and `deletedAt: null` (404 `expense.not_found` otherwise).
- [x] T034 [US1] Implement `activity(householdId, viewerId, { cursor, limit })` in `apps/api/src/expenses/ledgerService.ts` (research R9):
  - Read `limit + 1` rows from expenses and from settlements with the same keyset condition, merge them, and return `limit` items.
  - The cursor is base64 of `date|createdAt|id`; one that can't be decoded → 400 `request.invalid`.
  - Expense items carry `viewerPart`. Deleted records are included with `deleted: { by, at }`; for deleted expenses `viewerPart` is `none`.
- [x] T035 [US1] Implement the routers and mount them in `apps/api/src/app.ts` behind `requireAuth`, before the `/api/household` router:
  - `apps/api/src/expenses/expensesRouter.ts`: `GET /:id` (any member), `POST /` (`requireEditor`).
  - `apps/api/src/expenses/ledgerRouter.ts`: `GET /activity`, validating the query with `activityQuerySchema`.
  - Bodies are validated with the shared schemas through `parseBody`.
- [x] T036 [US1] Add `getActivity(cursor?)`, `getExpense(id)` and `createExpense(input)` to `apps/web/src/api/client.ts`, parsing responses with the shared schemas
- [x] T037 [US1] Create `apps/web/src/expenses/useExpenses.ts` (research R14):
  - `useActivity()`: an infinite query on `["household", "activity"]` with `refetchOnWindowFocus: true`.
  - `useExpense(id)`: `["household", "expense", id]`.
  - `useCreateExpense()`: invalidates activity and `["household", "balances"]`.
- [x] T038 [US1] Build `apps/web/src/expenses/ActivityList.tsx` (+ module.css):
  - Month headings via `Intl.DateTimeFormat` (month and year, active locale).
  - Rows with a receipt icon plus text: description, "{{name}} paid", `Amount`, date and the viewer's part ("You owe €10.70" / "You lent €32.10" / "Not involved").
  - Expense rows link to `/expenses/:id`; **Show more** loads the next page.
  - Copy in `expenses.json` en/es.
- [x] T039 [US1] Build `apps/web/src/pages/ExpensesPage/` (ExpensesPage.tsx + module.css):
  - Title, **Add expense** (only when `canEditContent(myRole)`), `ActivityList`, and `EmptyState` ("No expenses yet" + description).
  - Redirects to `/` without a household, like `HouseholdSettingsPage`.
  - Copy in `expenses.json` en/es (keys from `contracts/ui.md`).
- [x] T040 [US1] Build `apps/web/src/pages/ExpenseFormPage/` (create mode, household split only for now):
  - Fields: description and amount `TextField`s (`inputMode="decimal"`, `parseAmount`), **Who paid?** `Select` of current members (default me), date `TextField type="date"` (default and `max` = local today).
  - A `ChoiceGroup` "How should it be split?" with "The household's split" showing the percentages.
  - A live share preview with `splitAmount` and `Amount`.
  - The all-zero-weights note with a link to `/household/settings#split`.
  - On success, navigate to `/expenses/:id` with "Expense saved."
  - Copy in `expenses.json` en/es.
- [x] T041 [US1] Build `apps/web/src/pages/ExpenseDetailPage/`: amount, description, date (`Intl`), who paid, the method, every share with `Avatar` (`avatarPropsFor`) and `Amount`, and "Added by {{name}} on {{date}}"; copy in `expenses.json` en/es
- [x] T042 [US1] Register `/expenses`, `/expenses/new` (editors only; others go to `/expenses`) and `/expenses/:id` under `RequireAuth` in `apps/web/src/App.tsx`. Add the primary navigation (Home, Expenses) to `apps/web/src/layout/AppShell.tsx` when the person has a household, with `aria-current="page"` on the current link. Add the `common:nav.*` keys in en/es and test the nav in `apps/web/src/layout/AppShell.test.tsx` (create it if missing).

**Checkpoint**: US1 is demoable: record an expense with the household split and see it in the history and its details.

---

## Phase 4: User Story 2 - See who owes whom (Priority: P2)

**Goal**: Everyone sees each person's balance in words and the suggested payments; the home shows the viewer's own sentence.

**Independent Test**: Record a few expenses with different payers among three members and check that every member sees the same balances, that they add up to zero, and that the suggested payments would leave everyone at zero.

### Tests for User Story 2 ⚠️

- [x] T043 [P] [US2] Supertest suite `apps/api/test/balances.test.ts`:
  - **Totals:** `GET /api/household/balances` sums to 0, and every member gets identical figures.
  - **Spec example:** Ana 2000 for Bruno, Bruno 2000 for Carla → Bruno 0 and one suggestion Carla → Ana 2000.
  - **Shape:** current members in member order, members without records included at 0; `myBalanceCents`; at most `n − 1` suggestions.
  - **Access:** a GUEST can read; other households are isolated; no household → 404.
- [x] T044 [P] [US2] Web tests in `apps/web/src/pages/BalancesPage/BalancesPage.test.tsx` and `apps/web/src/pages/HomePage/HomePage.test.tsx`:
  - **`apps/web/src/pages/BalancesPage/BalancesPage.test.tsx`:** rows in words ("Ana is owed €20.00", "Carla owes €20.00", the viewer in the second person); suggestions phrased from the viewer ("You owe Ana…", "Bruno owes you…", "{{from}} owes {{to}}…"); the "All square! Nobody owes anything." empty state; axe.
  - **`apps/web/src/pages/HomePage/HomePage.test.tsx`:** the balance card shows the owe, owed or square sentence and links to Expenses and Balances; **Add expense** only for editors.

### Implementation for User Story 2

- [x] T045 [US2] Implement `balances(householdId, viewerId)` in `apps/api/src/expenses/ledgerService.ts` (research R4):
  - Four grouped sums over **live** records: `Expense` by `paidById`; `ExpenseShare` by `userId` with `expense: { householdId, deletedAt: null }`; `Settlement` by `fromUserId`; `Settlement` by `toUserId`.
  - Combine them with `netBalances`, include every current member (0 if absent) and former members with a non-zero balance, ordered by `orderPeople`.
  - Add `suggestSettlements`, the `PersonRef`s and `myBalanceCents`.
- [x] T046 [US2] Add `GET /balances` to `apps/api/src/expenses/ledgerRouter.ts`
- [x] T047 [US2] Add `getBalances()` to `apps/web/src/api/client.ts` and `useBalances()` (`["household", "balances"]`, `refetchOnWindowFocus: true`) to `apps/web/src/expenses/useExpenses.ts`
- [x] T048 [US2] Build `apps/web/src/expenses/BalanceSentence.tsx`, which renders the viewer's sentence with `formatAmount`: "You owe {{amount}} in total" / "You're owed {{amount}} in total" / "You're all square". Then build `apps/web/src/pages/BalancesPage/`:
  - Rows with `Avatar`, a sentence in words and `Amount`.
  - Suggestions phrased per FR-016.
  - An `EmptyState` for all square.
  - Register the `/balances` route in `apps/web/src/App.tsx`.
  - Copy in `expenses.json` en/es.
- [x] T049 [US2] Add the balance card to `HouseholdSummary` in `apps/web/src/pages/HomePage/HomePage.tsx`: `BalanceSentence`, links to Expenses and Balances, and **Add expense** for editors. Show `BalanceSentence` and a Balances link at the top of `ExpensesPage`.

**Checkpoint**: US1 + US2: expenses produce balances everyone agrees on.

---

## Phase 5: User Story 3 - Settle up (Priority: P3)

**Goal**: Editors record payments, prefilled from suggestions; balances follow and payments appear in the history.

**Independent Test**: With an open balance between two members, record the suggested payment and check that both balances return to zero and that the payment appears in the history.

### Tests for User Story 3 ⚠️

- [x] T050 [P] [US3] Supertest suite `apps/api/test/settlements.test.ts` (create and read):
  - **Create:** `POST /api/household/settlements` as ADMIN and as MEMBER → 201.
  - **Validation:** same person → 400 `settlement.same_person`; amount and future-date validation; a user who is neither a current member nor in the household's history → 400 `settlement.person.not_found`.
  - **Permissions:** GUEST → 403; `GET /:id` from another household → 404 `settlement.not_found`.
  - **Effect:** Bruno paying Ana 1320 brings both to 0; an overpayment is allowed and reverses the balance; settlements appear in `activity` in date order.
- [x] T051 [P] [US3] Web tests in `apps/web/src/expenses/PaymentDialog.test.tsx`, `apps/web/src/pages/BalancesPage/BalancesPage.test.tsx` and `apps/web/src/expenses/ActivityList.test.tsx` (create it):
  - **`apps/web/src/expenses/PaymentDialog.test.tsx`:** prefilled from a suggestion; the "Right now, {{from}} owes {{to}} {{amount}}." line; the reversal note when the amount exceeds it; validation messages; submitting invalidates activity and balances.
  - **`BalancesPage.test.tsx`:** **Record this payment** and **Record a payment** only for editors.
  - **`ActivityList`:** a payment row reads "{{from}} paid {{to}}" and opens the payment details dialog.

### Implementation for User Story 3

- [x] T052 [US3] Implement `get` and `create` in `apps/api/src/expenses/settlementService.ts`: both parties must be current members or pass `isInHistory` (`settlement.person.not_found`), the future-date rule applies, `PersonRef`s are built, and reads are scoped to the household and `deletedAt: null`
- [x] T053 [US3] Implement `apps/api/src/expenses/settlementsRouter.ts` (`GET /:id` any member, `POST /` `requireEditor`) and mount it at `/api/household/settlements` in `apps/api/src/app.ts`
- [x] T054 [US3] Add `getSettlement(id)` and `createSettlement(input)` to `apps/web/src/api/client.ts`, and `useSettlement` and `useCreateSettlement` (invalidating activity and balances) to `apps/web/src/expenses/useExpenses.ts`
- [x] T055 [US3] Build `apps/web/src/expenses/PaymentDialog.tsx` (record and view modes) on `Dialog`:
  - **Fields:** From and To `Select`s (current members plus former members with an open balance), Amount (`parseAmount`) and Date.
  - **What's owed between the two (FR-020):** the suggested payment from → to in the balances view, shown as `expenses:payment.owedNow` when present.
  - **The reversal note:** simulate the balances after the payment (from + amount, to − amount), run `suggestSettlements`, and show `expenses:payment.reverses` with the resulting to → from amount when one appears.
  - **View mode:** who paid whom, the amount, the date and "Added by".
  - Copy in `expenses.json` en/es.
- [x] T056 [US3] Wire **Record this payment** (prefilled) and **Record a payment** into `apps/web/src/pages/BalancesPage/BalancesPage.tsx` for editors. Make payment rows in `apps/web/src/expenses/ActivityList.tsx` open `PaymentDialog` in view mode with a payment icon plus "{{from}} paid {{to}}".

**Checkpoint**: US1–US3: the full money loop (spend, see, settle) works.

---

## Phase 6: User Story 4 - Split an expense differently (Priority: P4)

**Goal**: Split equally among chosen people or with exact amounts per person.

**Independent Test**: Add one expense split equally among some members and one with exact amounts, and check each person's share and the resulting balances.

### Tests for User Story 4 ⚠️

- [x] T057 [P] [US4] Add a "other splits" describe to `apps/api/test/expenses.test.ts`:
  - **EQUAL:** 1000 among three → 334/333/333 in member order; 2 among three stores 1/1/0, the zero included; a GUEST and a weight-0 member can be chosen.
  - **EXACT:** must sum to the amount (`expense.split.mismatch`); amounts of 0 are not stored.
  - **Payer:** a payer who doesn't share is allowed, and the whole amount is owed to them.
  - **Errors:** duplicate people → `expense.split.invalid`; someone who isn't a current member → `expense.person.not_member`.
- [x] T058 [P] [US4] Extend `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.test.tsx`:
  - **Equally:** a people `ChoiceGroup multiple` with all current members preselected and a live share per chosen person; at least one required.
  - **Exact amounts:** inline fields with "€2.50 left to assign" / "€1.00 over the total"; **Save** disabled until the amounts add up.
  - Guests and weight-0 members are selectable.

### Implementation for User Story 4

- [x] T059 [US4] Add the `EQUAL` (`splitAmount` with weight 1 per chosen person, in member order, storing every chosen person) and `EXACT` (stored as entered, amounts > 0 only) branches to `create` in `apps/api/src/expenses/expenseService.ts`, with every person a current member
- [x] T060 [US4] Add "Equally between…" and "Exact amounts" to `ExpenseFormPage`: a `ChoiceGroup multiple` of people with live shares, and inline `TextField`s per person with left or over messages via `formatAmount`. Copy in `expenses.json` en/es.
- [x] T061 [US4] Show the method on `ExpenseDetailPage` ("The household's split", "Equally between {{count}} people", "Exact amounts", with `_one`/`_other` plurals); copy in en/es

**Checkpoint**: every way of splitting works and balances follow.

---

## Phase 7: User Story 5 - Fix mistakes (Priority: P5)

**Goal**: Any editor edits or deletes any expense or payment, guarded by versions. Every record shows who recorded and changed it, and deletions leave a line in the history.

**Independent Test**: Edit an expense's amount and split, delete another one and a settlement, and check that balances follow each change, that each record shows who recorded and last changed it, and that each deletion leaves a line in the history saying who deleted what.

### Tests for User Story 5 ⚠️

- [x] T062 [P] [US5] Add an "editing and deleting" describe to `apps/api/test/expenses.test.ts`:
  - **Edit:** `PUT` as an editor changes fields and split, bumps `version` and sets `editedBy`/`editedAt`. A stale `version` → 409 `expense.changed` with nothing changed.
  - **Default-split rules (research R3):**
    - Unchanged amount: keeps its stored shares even after the weights changed.
    - Changed amount: rescales (4280 at 3210/1070 → 4400 gives 3300/1100).
    - Switching from EQUAL to WEIGHTS: uses the current weights.
  - **Former members:** one already in the expense may stay; one can't be added (`expense.person.not_member`).
  - **Delete:** `DELETE ?version=n` → 204 and sets `deletedAt`/`deletedById`. Then `GET`, `PUT` and a second `DELETE` → 404 `expense.not_found`; balances exclude it; `activity` keeps it with `deleted: { by, at }` and `viewerPart` `none`. A missing version → 400 `request.invalid`; a stale version → 409.
  - **Permissions:** GUEST → 403; another household's id → 404.
- [x] T063 [P] [US5] Add the matching "editing and deleting" describe to `apps/api/test/settlements.test.ts`: versions, 409 `settlement.changed`, soft delete with 404 afterwards, balances excluding deleted settlements, `deleted` set in `activity`, GUEST 403, other household 404
- [x] T064 [P] [US5] Web tests in `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.test.tsx`, `apps/web/src/pages/ExpenseDetailPage/ExpenseDetailPage.test.tsx`, `apps/web/src/expenses/ActivityList.test.tsx` and `apps/web/src/expenses/PaymentDialog.test.tsx`:
  - **`ExpenseFormPage.test.tsx`** (edit mode):
    - Prefilled values.
    - A default-split expense reads "The household's split when it was added (Ana 75 %, Bruno 25 %)", from its stored shares.
    - Changing the amount previews the rescaled shares.
    - A 409 shows the `expense.changed` `Alert` and reloads the latest version.
  - **`ExpenseDetailPage.test.tsx`:** "Changed by"; **Delete** opens a dialog naming the expense with focus on **Cancel**; confirming navigates to `/expenses`.
  - **`ActivityList`:** deleted records render as muted lines that aren't links ("Ana deleted '…' (€42.80)").
  - **`PaymentDialog.test.tsx`:** edit and delete.

### Implementation for User Story 5

- [x] T065 [US5] Implement `update` and `remove` in `apps/api/src/expenses/expenseService.ts`:
  - **Updates** use `updateMany WHERE id, householdId, version, deletedAt null`, then distinguish 409 from 404. They replace the shares in the same transaction under `lockHousehold`, set `editedById`/`editedAt` and bump `version`.
  - **Default split (R3):** keep the stored shares when the amount is unchanged; rescale with `splitAmount(newAmount, oldShares)` when it changes; use the current weights when switching from another method.
  - **Former members (R11):** people already in the expense may stay; no new former members.
  - **Remove** is a soft delete setting `deletedAt`/`deletedById`, guarded by `version` (R17).
- [x] T066 [US5] Implement `update` and `remove` in `apps/api/src/expenses/settlementService.ts` with the same version and soft-delete rules
- [x] T067 [US5] Add `PUT /:id` and `DELETE /:id` (with a `version` query param parsed as a positive integer, otherwise 400 `request.invalid`) to `expensesRouter.ts` and `settlementsRouter.ts`, both behind `requireEditor`
- [x] T068 [US5] Add `updateExpense`, `deleteExpense(id, version)`, `updateSettlement` and `deleteSettlement` to `apps/web/src/api/client.ts`, with mutations in `useExpenses.ts` that invalidate activity, balances and the record's key
- [x] T069 [US5] Add edit mode to `ExpenseFormPage` under the `/expenses/:id/edit` route (editors only) in `App.tsx`:
  - The stored shares, and the "when it was added" label built with `Intl.ListFormat` and percentages.
  - The rescale preview when the amount changes.
  - Handling for 409 `expense.changed`.
  - On `ExpenseDetailPage`, add **Edit**, **Delete** (with the confirmation `Dialog`) and "Changed by {{name}} on {{date}}".
  - Copy in en/es.
- [x] T070 [US5] Render deleted records in `ActivityList` as muted lines with a trash icon and `expenses:history.deletedExpense` / `deletedPayment`, without links. Add edit and delete (`expenses:payment.delete.*`) to `PaymentDialog`. Copy in en/es.

**Checkpoint**: mistakes can be fixed openly; nothing disappears without a trace.

---

## Phase 8: User Story 6 - People move out without losing the history (Priority: P6)

**Goal**: People who leave stay in the history as former members, their balance keeps counting until settled, they can be paid or pay back, and the leave and remove dialogs show open balances.

**Independent Test**: With a member who has an open balance, have them leave; check that the history and balances still show them as a former member, that a payment with them can be recorded, and that they cannot be added to new expenses.

### Tests for User Story 6 ⚠️

- [x] T071 [P] [US6] Supertest suite `apps/api/test/formerMembers.test.ts`:
  - **Leaving:** after someone leaves with an open balance, `balances` lists them with `former: true` and their balance.
  - **Payments:** a settlement with them is allowed and brings them to 0, after which they drop out of the balances.
  - **New expenses:** a former member as payer or sharer → 400 `expense.person.not_member`.
  - **Their own session:** 404 on every expenses endpoint.
  - **Rejoining:** through a new invitation they come back with `former: false` and get their history and balance back.
  - **Names:** `activity` `PersonRef`s carry the `former` flags.
  - **Deleted records:** a user who appears only in deleted records isn't "in the history" (settlement → 400 `settlement.person.not_found`).
- [x] T072 [P] [US6] Add to `apps/api/test/members.test.ts`: leaving and removal with an open balance still succeed (204 / 200); the last member leaving a household with expenses and settlements deletes them all (`expense`, `expenseShare` and `settlement` counts are 0)
- [x] T073 [P] [US6] Web tests in `apps/web/src/pages/HouseholdSettingsPage/MembersSection.test.tsx`, `apps/web/src/pages/BalancesPage/BalancesPage.test.tsx` and `apps/web/src/expenses/PaymentDialog.test.tsx`:
  - **`MembersSection.test.tsx`:** the leave dialog shows "You still owe {{amount}} in total…" or the owed variant when the balance isn't 0, and nothing when it is; the remove dialog shows the person's balance; the last-member copy mentions expenses and payments.
  - **`BalancesPage.test.tsx`:** the former member `Badge` and a muted avatar.
  - **`PaymentDialog.test.tsx`:** offers former members with an open balance.

### Implementation for User Story 6

- [x] T074 [US6] Check the former-member rules end to end in `apps/api/src/expenses/` (`people.ts` flags, settlement eligibility over live history, keeping existing people on expense edit) and fix any gap found by T071
- [x] T075 [US6] Make `apps/web/src/pages/HouseholdSettingsPage/MembersSection.tsx` balance-aware with `useBalances`:
  - Add `household:settings.members.leaveOwes` / `leaveOwed` / `removeOwes` / `removeOwed` to the dialogs when the balance isn't 0.
  - Update the value of `household:settings.members.leaveLastDescription` to mention expenses and payments.
  - Make the leave and remove mutations in `apps/web/src/household/useHousehold.ts` also invalidate `["household", "balances"]`.
  - Copy in `household.json` en/es (from `contracts/ui.md`).
- [x] T076 [US6] Show former members with a muted `Avatar` and a "Former member" `Badge` (`expenses:balances.former`) in `apps/web/src/pages/BalancesPage/BalancesPage.tsx`, `apps/web/src/expenses/ActivityList.tsx`, `apps/web/src/pages/ExpenseDetailPage/ExpenseDetailPage.tsx` and the edit form in `apps/web/src/pages/ExpenseFormPage/ExpenseFormPage.tsx`, and offer former members with an open balance in `apps/web/src/expenses/PaymentDialog.tsx`

**Checkpoint**: all six stories work independently and together.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T077 [P] Write Cypress flows in `apps/web/cypress/e2e/expenses.cy.ts` with a stubbed API (`cy.intercept`, following `household.cy.ts`), covering the six flows in `quickstart.md`:
  1. The household split, and the home sentence.
  2. Equal and exact splits.
  3. Settling up from a suggestion.
  4. A second person's expense arriving on refetch.
  5. An edit conflict.
  6. Deleting, which leaves a muted line.
- [x] T078 [P] Run the `docs/design.md` checklist on Expenses, the expense form, details, Balances, the payment dialog, the home card and the settings dialogs. Check light and dark, en and es, and 375 px; fix anything found (tokens only, visible focus, color never alone, warm copy, nothing clipped in Spanish).
- [x] T079 [P] Review `packages/ui/src/components/Amount/`, `ChoiceGroup/`, `Select/` and the `Avatar/` muted variant in Storybook in light and dark and with the Locale toolbar in en and es (canvas, docs page and chrome), and fix anything found (the lesson from households T065)
- [x] T080 [P] Regenerate the "New i18n keys" section of `specs/002-expenses/contracts/ui.md` from the JSON files, in en and es: the whole `expenses` namespace, the changed `household` keys, the `common:nav.*` keys and the 16 `errors.*` codes. Make it match the code exactly (the lesson from households T063).
- [x] T081 [P] Check every cell of the permission matrix in `specs/002-expenses/contracts/api.md` against the Supertest suites (ADMIN, MEMBER, GUEST, former member, other household, no household × each endpoint) and add any missing case (the lesson from households T062)
- [x] T082 [P] Update the status table in `README.md`: expenses with splits, balances and settling up becomes ✅; chores, shopping list and real time stay 🔜
- [x] T083 Run the full gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (API against Docker `hogar_test`) and `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e`
- [ ] T084 Walk through the 13 manual scenarios in `specs/002-expenses/quickstart.md` with two browsers on `pnpm dev`, and fix any gap against the spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup and blocks every story. T006–T008 depend on their tests (T003–T005); T010 on T009; T014 on T013; T015 on T014; T022–T025 on their tests (T018–T021); T026 on T023; T028 on T027.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on US1 (balances need expenses to exist). The API part (T043, T045, T046) can start once T033 is done.
- **US3 (Phase 5)**: depends on US2 (payments are prefilled from suggestions, and the dialog reads the balances view).
- **US4 (Phase 6)**: depends on US1 only, so it can run in parallel with US2 and US3.
- **US5 (Phase 7)**: depends on US1 for expenses and on US3 for settlements.
- **US6 (Phase 8)**: depends on US2 and US3 (former members live in balances and payments) and on US5 for keeping them on edits.
- **Polish (Phase 9)**: after every story.

### Within Each User Story

- Tests are written first and fail, then the service, router, client and hooks, then the UI.
- `expenseService.ts`, `settlementService.ts`, `ledgerService.ts`, `client.ts`, `useExpenses.ts`, `ExpenseFormPage` and `expenses.json` are shared files, so tasks touching them run in sequence across stories.

### Parallel Opportunities

- **Phase 2:** T003–T005 run together, then T006–T008. The UI tests T018–T021 run together, then T022–T025. T027–T029 run alongside the shared and UI work.
- **US1:** T030–T032 run together. The API tasks (T033–T035) and the web building blocks that don't touch the client (T038) can proceed in parallel.
- **US4** can run alongside **US2/US3** once US1 is done, as long as the shared files above are handled in sequence.
- **Polish:** T077–T082 run together.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
T030 apps/api/test/expenses.test.ts
T031 apps/api/test/activity.test.ts
T032 apps/web/src/pages/{ExpensesPage,ExpenseFormPage,ExpenseDetailPage}/*.test.tsx

# Then, in parallel:
T033–T035 API (service → ledger → routers)
T038 ActivityList   |   T041 ExpenseDetailPage (after T036–T037)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1). **Stop and validate:** record an expense with the household split, see it in the history and its details; the full gate is green.

### Incremental Delivery

1. US1, then validate and commit (`feat(shared)`, `feat(api)`, `feat(ui)`, `feat(web)` commits per group).
2. US2: balances and the home sentence. Validate quickstart scenarios 1–3.
3. US3: settle up. Scenario 4.
4. US4: other splits (can go before US2/US3 if convenient). Scenarios 5–6.
5. US5: edit and delete with versions and traces. Scenarios 7, 8 and 12.
6. US6: former members. Scenarios 9–11.
7. Polish, then the whole quickstart, then a PR to `main`.

## Notes

- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- Commit after each task group with Conventional Commits in English, with no AI attribution.
- Stop at any checkpoint if format, lint, typecheck or tests are red.
- Mark tasks `[X]` in this file as they are completed.
