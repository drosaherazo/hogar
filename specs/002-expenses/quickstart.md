# Quickstart: validating the expenses feature

How to prove the feature works end to end. Contracts: [contracts/api.md](contracts/api.md), [contracts/ui.md](contracts/ui.md). Data: [data-model.md](data-model.md). Decisions: [research.md](research.md).

## Prerequisites

- `pnpm install`, `.env` files copied from the examples (see `docs/setup-google-oauth.md`).
- Docker Desktop running, then `pnpm db:up` (Postgres 17 with `hogar` and `hogar_test`).
- `pnpm db:migrate` applies the new `expenses` migration (tables `expenses`, `expense_shares`, `settlements` and their `CHECK` constraints).

## Automated checks (all must pass)

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm --filter @hogar/shared test   # splitAmount, netBalances, suggestSettlements, viewerPart, schemas (+ seeded generated cases)
pnpm --filter @hogar/api test      # Supertest: 10 endpoints × permission matrix, versions, former members, cascade
pnpm --filter @hogar/ui test       # Amount, ChoiceGroup, Select, Avatar muted (+ axe)
pnpm --filter @hogar/web test      # pages with MSW, parseAmount, i18n parity incl. 15 new error codes
env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e   # Cypress flows below (API and Google stubbed)
```

## Manual scenarios (two browsers: A = Ana, ADMIN; B = Bruno, MEMBER; C = Carla, GUEST later)

Start from a household with Ana and Bruno and weights 3 / 1 (households quickstart, scenarios 1–6).

| #   | Steps                                                                                            | Expected                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A: Expenses → Add expense → "Groceries", 42,80 (es) or 42.80 (en), paid by Ana, today            | Saved with the household split: Ana €32.10, Bruno €10.70. First in both histories; B's row says "You owe €10.70".                                                                               |
| 2   | A adds €10.01 with the household split                                                           | Shares €7.51 / €2.50 (the leftover cent goes to Ana, who joined first).                                                                                                                         |
| 3   | B (after focusing the tab): Home and Balances                                                    | Home: "You owe €13.20 in total". Balances: "You owe Ana €13.20" as the only suggestion; A sees "Bruno owes you €13.20".                                                                         |
| 4   | B: Record this payment → confirm                                                                 | Both see "All square! Nobody owes anything." The history shows "Bruno paid Ana €13.20".                                                                                                         |
| 5   | A: Add expense → €10.00, "Equally between…" Ana, Bruno and Carla (after C joins as GUEST)        | Shares €3.34 / €3.33 / €3.33. C can see it but has no Add, Edit, Delete or Record buttons.                                                                                                      |
| 6   | B: Add expense → €50.00 paid by Bruno, "Exact amounts" Bruno 30, Ana 15                          | Shows "€5.00 left to assign" and Save is disabled; with Bruno 30, Ana 20 it saves.                                                                                                              |
| 7   | A and B open the same expense's edit form; A saves, then B saves                                 | B is told it changed meanwhile and sees A's version.                                                                                                                                            |
| 8   | A changes the weights to 1 / 1, then edits expense 1                                             | Its shares are still €32.10 / €10.70, and the option reads "The household's split when it was added (Ana 75 %, Bruno 25 %)". Changing its amount to €44.00 shows €33.00 / €11.00 before saving. |
| 9   | C (who owes €3.33) leaves                                                                        | The leave dialog says "You still owe €3.33 in total…". After leaving, A's balances list Carla as a former member with €3.33.                                                                    |
| 10  | A: Record a payment from Carla to Ana, €3.33                                                     | Carla disappears from the balances; her expenses keep showing her name with a "former member" badge.                                                                                            |
| 11  | A: Add expense → Carla isn't offered as payer or to share                                        | Former members only appear in payments and in expenses they were already part of.                                                                                                               |
| 12  | A deletes the €10.01 expense from scenario 2 and confirms                                        | Bruno's €2.50 share of it no longer counts. The history keeps a muted line, "Ana deleted '…' (€10.01)", that can't be opened.                                                                   |
| 13  | Switch to Spanish and dark theme on Expenses, the form, details, Balances and the payment dialog | Amounts read "12,50 €", dates in Spanish, warm copy, AA contrast, visible focus; nothing clipped at 375 px.                                                                                     |

## Cypress flows to add (`apps/web/cypress/e2e/expenses.cy.ts`)

1. Add an expense with the household split, and see it in the history and in the home balance sentence.
2. Split equally among some people, and with exact amounts (left-to-assign message, then save).
3. Settle up from a suggested payment, and see "All square".
4. A second person's expense arrives (stubbed `GET /api/household/activity` and `/balances` switched, then a window focus refetch) and the balances update.
5. Edit conflict: the stubbed `PUT` returns 409 `expense.changed`, and the form shows the latest version.
6. Delete an expense: the confirmation names it, and afterwards the history shows the muted "deleted by" line instead of the row.
