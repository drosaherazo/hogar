# API contract: Expenses

REST, JSON. Every endpoint requires `Authorization: Bearer <access token>` and resolves the caller's household on the server (`/api/household/…`, as in households). Bodies are validated with the Zod schemas in `packages/shared/src/expenses.ts`. Errors use the existing shape `{ "error": { "code": "<code>" } }`.

Authorization legend: **any** = any member of the caller's household (GUEST included); **editor** = ADMIN or MEMBER (`canEditContent(role)`). Without a household, every endpoint answers 404 `household.not_member`.

## Types (shared, Zod)

```ts
Cents = number            // integer euro cents; amounts in bodies are 1 – 10_000_000
CalendarDate = string     // "YYYY-MM-DD"
SplitMethod = "WEIGHTS" | "EQUAL" | "EXACT"

PersonRef = { userId: string, name: string, avatarUrl: string | null,
              former: boolean /* in the history but no longer a member */ }

// Requests
ExpenseSplitInput =
  | { method: "WEIGHTS" }
  | { method: "EQUAL", userIds: string[] }                          // ≥ 1, unique
  | { method: "EXACT", shares: { userId: string, amountCents: Cents | 0 }[] }  // ≥ 1, unique, sum = amountCents

ExpenseInput = { description: string /* 1–100 after trim */, amountCents: Cents,
                 paidById: string, date: CalendarDate, split: ExpenseSplitInput }
UpdateExpenseInput = ExpenseInput & { version: number }

SettlementInput = { fromUserId: string, toUserId: string /* ≠ from */, amountCents: Cents, date: CalendarDate }
UpdateSettlementInput = SettlementInput & { version: number }

// Responses
ExpenseView = { id, description, amountCents, date, paidBy: PersonRef,
                split: { method: SplitMethod, shares: { person: PersonRef, amountCents: number }[] /* member order */ },
                createdBy: PersonRef, createdAt: string /* ISO */,
                editedBy: PersonRef | null, editedAt: string | null, version: number }

SettlementView = { id, from: PersonRef, to: PersonRef, amountCents, date,
                   createdBy: PersonRef, createdAt: string, editedBy: PersonRef | null, editedAt: string | null,
                   version: number }

ActivityItem =
  | { kind: "expense", id, description, amountCents, date, paidBy: PersonRef,
      viewerPart: { kind: "owes" | "lent" | "none", amountCents: number } }
  | { kind: "settlement", id, amountCents, date, from: PersonRef, to: PersonRef }
ActivityPage = { items: ActivityItem[] /* date desc, createdAt desc, id desc */, nextCursor: string | null }

PersonBalance = { person: PersonRef, balanceCents: number /* > 0 is owed, < 0 owes */ }
SuggestedSettlement = { from: PersonRef, to: PersonRef, amountCents: number }
BalancesView = { balances: PersonBalance[]   /* current members in member order, then former members with ≠ 0 */,
                 suggestions: SuggestedSettlement[], myBalanceCents: number }
```

## History and balances

| Method & path                 | Auth | Query                                   | Success            | Errors                     |
| ----------------------------- | ---- | --------------------------------------- | ------------------ | -------------------------- |
| `GET /api/household/activity` | any  | `cursor?` (opaque), `limit?` (1–50, 30) | 200 `ActivityPage` | 400 `request.invalid`; 404 |
| `GET /api/household/balances` | any  | —                                       | 200 `BalancesView` | 404                        |

## Expenses

| Method & path                        | Auth   | Body                 | Success                        | Errors                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------ | -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/household/expenses/:id`    | any    | —                    | 200 `{ expense: ExpenseView }` | 404 `expense.not_found`                                                                                                                                                                                                                                                              |
| `POST /api/household/expenses`       | editor | `ExpenseInput`       | 201 `{ expense: ExpenseView }` | 400 `expense.description.required` / `expense.description.too_long` / `money.amount.invalid` / `money.date.invalid` / `money.date.future` / `expense.split.invalid` / `expense.split.mismatch` / `expense.split.no_default` / `expense.person.not_member`; 403 `household.forbidden` |
| `PUT /api/household/expenses/:id`    | editor | `UpdateExpenseInput` | 200 `{ expense: ExpenseView }` | as POST; 404 `expense.not_found`; 409 `expense.changed`                                                                                                                                                                                                                              |
| `DELETE /api/household/expenses/:id` | editor | — (`?version=`)      | 204                            | 400 `request.invalid` (no version); 403; 404 `expense.not_found`; 409 `expense.changed`                                                                                                                                                                                              |

Rules the API enforces beyond the schema:

- `paidById` and every person in `split` must be current members. **On `PUT`**, people already in that expense (as payer or share) may stay even if they are former members, but no former member can be added (`expense.person.not_member`).
- `WEIGHTS` when every current weight is 0 → 400 `expense.split.no_default`.
- `WEIGHTS` on `PUT`, with an unchanged amount, keeps the stored shares. With a changed amount, it rescales them (research R3).
- Shares are returned and stored in member order. Former members come after current members, by name.

## Settlements (payments)

| Method & path                           | Auth   | Body                    | Success                              | Errors                                                                                                                                  |
| --------------------------------------- | ------ | ----------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/household/settlements/:id`    | any    | —                       | 200 `{ settlement: SettlementView }` | 404 `settlement.not_found`                                                                                                              |
| `POST /api/household/settlements`       | editor | `SettlementInput`       | 201 `{ settlement: SettlementView }` | 400 `money.amount.invalid` / `money.date.invalid` / `money.date.future` / `settlement.same_person` / `settlement.person.not_found`; 403 |
| `PUT /api/household/settlements/:id`    | editor | `UpdateSettlementInput` | 200 `{ settlement: SettlementView }` | as POST; 404 `settlement.not_found`; 409 `settlement.changed`                                                                           |
| `DELETE /api/household/settlements/:id` | editor | — (`?version=`)         | 204                                  | 400 `request.invalid`; 403; 404 `settlement.not_found`; 409 `settlement.changed`                                                        |

`fromUserId` and `toUserId` must each be a current member or a person in the household's history (`settlement.person.not_found` otherwise, without revealing whether that user exists elsewhere).

## Permission matrix (each cell gets a Supertest case)

| Endpoint                       | ADMIN | MEMBER | GUEST | former member | other household                   | no household |
| ------------------------------ | ----- | ------ | ----- | ------------- | --------------------------------- | ------------ |
| GET activity / balances        | 200   | 200    | 200   | 404           | own data only                     | 404          |
| GET expense / settlement by id | 200   | 200    | 200   | 404           | 404 (id not in own household)     | 404          |
| POST expense / settlement      | 201   | 201    | 403   | 404           | 400 (people not in own household) | 404          |
| PUT expense / settlement       | 200   | 200    | 403   | 404           | 404                               | 404          |
| DELETE expense / settlement    | 204   | 204    | 403   | 404           | 404                               | 404          |

"Former member" means someone who left or was removed, calling with their own session: they have no household, so they get 404 like anyone without one.

## Changes to existing endpoints

None. `POST /api/household/leave` and `DELETE /api/household/members/:id` keep working with open balances (clarification Q1); the warning lives in the web (research R12). Deleting the household when the last member leaves now also deletes its expenses, shares and settlements (FK cascade).

## New error codes (15)

`money.amount.invalid`, `money.date.invalid`, `money.date.future`, `expense.description.required`, `expense.description.too_long`, `expense.split.invalid`, `expense.split.mismatch`, `expense.split.no_default`, `expense.person.not_member`, `expense.not_found`, `expense.changed`, `settlement.same_person`, `settlement.person.not_found`, `settlement.not_found`, `settlement.changed`.

Each is added to `ERROR_CODES` in `packages/shared/src/errors.ts` with warm `en` and `es` messages in `apps/web/src/i18n/locales/{en,es}/errors.json` (for example `expense.changed`: "Someone changed this expense while you were editing it. Here's the latest version."; `expense.split.mismatch`: "The amounts don't add up to the total yet.").
