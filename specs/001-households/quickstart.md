# Quickstart: validating the households feature

How to prove the feature works end to end. Contracts: [contracts/api.md](contracts/api.md), [contracts/ui.md](contracts/ui.md). Data: [data-model.md](data-model.md).

## Prerequisites

- `pnpm install`, then `.env` files copied from the examples (see `docs/setup-google-oauth.md`).
- Docker running (WSL 2 on Windows), then `pnpm db:up` for Postgres 17 with the `hogar` and `hogar_test` databases.
- `pnpm db:migrate` applies the new `households` migration.

## Automated checks (all must pass)

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm --filter @hogar/shared test   # weightsToBasisPoints, checkAdminInvariant, schemas
pnpm --filter @hogar/api test      # Supertest: every endpoint × permission matrix, concurrency
pnpm --filter @hogar/ui test       # TextField, Dialog, Alert (+ axe)
pnpm --filter @hogar/web test      # pages with MSW, i18n parity incl. new error codes
pnpm --filter @hogar/web e2e       # Cypress flows below (API and Google stubbed)
```

## Manual scenarios (two browsers: A = normal window, B = private window)

| #   | Steps                                                               | Expected                                                                                           |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | A signs in → "Create a household" → name "Casa Ana"                 | Household home; A is the only member, ADMIN, 100 %.                                                |
| 2   | A: Settings → Invite → MEMBER → copy link                           | Link `…/invite#…`, "works once, 12 hours". Listed as pending.                                      |
| 3   | B (signed out) opens the link                                       | Login, then back on the invitation: "Ana invites you to Casa Ana as a member". Nothing joined yet. |
| 4   | B → Join                                                            | B in the household with weight 1. A (after focusing the tab) sees B and the split banner.          |
| 5   | B opens the same link again (or a third user)                       | "This link was already used" + ask for a new one.                                                  |
| 6   | A sets weights 3 / 1 → Save                                         | 75 % / 25 % for both; banner gone.                                                                 |
| 7   | A tries to leave while the only admin                               | Refused: "make someone else admin first".                                                          |
| 8   | A makes B admin, then removes B                                     | B's next visit: no-household screen with a gentle note naming Casa Ana, shown once.                |
| 9   | A creates an invitation, then revokes it; or renews an expired one  | The revoked link shows "revoked"; renew gives a new link with the same role.                       |
| 10  | Switch the language to Spanish and the theme to dark on each screen | All copy translated; contrast and focus visible.                                                   |

## Cypress flows to add (`apps/web/cypress/e2e/household.cy.ts`)

1. Create a household from the empty home.
2. Invite → copy view → (stubbed) accept as a second user → member appears after refetch.
3. Invitation page states: valid, already used, has another household.
4. Edit split weights and see percentages update; banner disappears on save.
