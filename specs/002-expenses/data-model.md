# Data model: Expenses

PostgreSQL via Prisma 7 (`apps/api/prisma/schema.prisma`). Table and column names are snake_case through `@@map`/`@map`, and ids are `cuid()`, as in the existing models. Money is always an `Int` number of euro cents (principle II).

## Enums

- **SplitMethod:** `WEIGHTS` (the household's default split) | `EQUAL` (equally among chosen people) | `EXACT` (an amount per person). Mirrored in `packages/shared` as `splitMethodSchema`.

## Expense (`expenses`)

| Field       | Type                | Rules                                                                        |
| ----------- | ------------------- | ---------------------------------------------------------------------------- |
| id          | String (cuid)       | PK                                                                           |
| householdId | String              | FK → Household, `onDelete: Cascade`                                          |
| description | String              | 1–100 chars after trimming (shared schema)                                   |
| amountCents | Int                 | 1 – 10,000,000 (€0.01 – €100,000.00); DB `CHECK` + shared schema             |
| date        | DateTime `@db.Date` | calendar day; not later than the server's UTC date + 1 day (research R7)     |
| paidById    | String              | FK → User, `onDelete: Restrict`; a current member when saved                 |
| splitMethod | SplitMethod         | how the shares were computed                                                 |
| createdById | String              | FK → User, `onDelete: Restrict`                                              |
| createdAt   | DateTime            | default now                                                                  |
| editedById  | String?             | FK → User, `onDelete: Restrict`; set on every edit                           |
| editedAt    | DateTime?           | set on every edit                                                            |
| version     | Int                 | default 1; incremented on every edit; guards edits and deletes (research R6) |

Indexes: `(householdId, date DESC, createdAt DESC, id DESC)` for the history feed; `(householdId, paidById)` for balance sums.

Relations: `shares` (1–n, cascade on delete).

## ExpenseShare (`expense_shares`)

| Field       | Type   | Rules                             |
| ----------- | ------ | --------------------------------- |
| expenseId   | String | FK → Expense, `onDelete: Cascade` |
| userId      | String | FK → User, `onDelete: Restrict`   |
| amountCents | Int    | ≥ 0; DB `CHECK`                   |

Primary key: `(expenseId, userId)`, so a person appears at most once per expense. Index: `userId`.

Invariant (enforced by the service in the same transaction as the expense, and tested): **the shares of an expense add up exactly to its `amountCents`**.

Which shares are stored (research R2):

| Method    | Stored shares                                                                      |
| --------- | ---------------------------------------------------------------------------------- |
| `WEIGHTS` | members with weight > 0 at save time, `splitAmount(amount, weights)`               |
| `EQUAL`   | every chosen person, `splitAmount(amount, 1 each)`; €0.00 allowed for tiny amounts |
| `EXACT`   | people with an amount > 0, exactly as entered                                      |

Editing (research R3): a `WEIGHTS` expense whose amount is unchanged keeps its shares. If the amount changes, the new shares are `splitAmount(newAmount, oldShares)`. Any other edit replaces the shares in the same transaction that bumps `version`.

## Settlement (`settlements`)

| Field       | Type                | Rules                                                                  |
| ----------- | ------------------- | ---------------------------------------------------------------------- |
| id          | String (cuid)       | PK                                                                     |
| householdId | String              | FK → Household, `onDelete: Cascade`                                    |
| fromUserId  | String              | FK → User, `onDelete: Restrict`; who paid                              |
| toUserId    | String              | FK → User, `onDelete: Restrict`; who received; DB `CHECK (from <> to)` |
| amountCents | Int                 | 1 – 10,000,000; DB `CHECK`                                             |
| date        | DateTime `@db.Date` | same rule as expenses                                                  |
| createdById | String              | FK → User, `onDelete: Restrict`                                        |
| createdAt   | DateTime            | default now                                                            |
| editedById  | String?             | FK → User                                                              |
| editedAt    | DateTime?           | —                                                                      |
| version     | Int                 | default 1                                                              |

Indexes: `(householdId, date DESC, createdAt DESC, id DESC)`; `(householdId, fromUserId)`; `(householdId, toUserId)`.

`fromUserId` and `toUserId` must each be a current member or a person in the household's history: payer or share in one of its expenses, or party to one of its settlements (research R11).

## Existing models

- **Household:** new back-relations `expenses` and `settlements`. Deleting a household (its last member leaves) cascades to both, and to shares through `Expense` (FR-030).
- **User:** new back-relations for every FK above. Users are never deleted, so `Restrict` never blocks anything in practice; it only guards against accidental loss of history.
- **Membership:** unchanged. Leaving and removal still delete the row; the person becomes a former member of that household's history (research R1).

## Derived views (never stored)

- **Former member** of household H: a user referenced by H's expenses, shares or settlements with no `Membership` in H.
- **Balance** per user (research R4): `paid − owed + sent − received`, where `paid` = Σ `Expense.amountCents` by `paidById`, `owed` = Σ `ExpenseShare.amountCents` by `userId`, `sent` = Σ `Settlement.amountCents` by `fromUserId`, `received` = Σ by `toUserId`, all within H. Positive = is owed money. Σ over all users = 0.
- **Suggested payments** (research R5): `suggestSettlements(balances)`; at most `n − 1` transfers for `n` non-zero balances.
- **Viewer's part** of an expense (research R9): `owes` (their share when someone else paid), `lent` (amount − their share when they paid) or `none`.

## Constraints added to the generated migration

Prisma can't express these, so they are appended to the generated `migration.sql` (as households did for weights):

```sql
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 10000000);
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_amount_nonnegative" CHECK ("amount_cents" >= 0);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 10000000);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_different_people" CHECK ("from_user_id" <> "to_user_id");
```

## Test data reset

`apps/api/test/testApp.ts` truncates tables before each test: add `"expense_shares"`, `"expenses"` and `"settlements"` to the `TRUNCATE … CASCADE` list.
