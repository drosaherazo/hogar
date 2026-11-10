# Implementation Plan: Households with link invitations, members and a weighted split

**Branch**: `feat/households` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-households/spec.md`

## Summary

Add the household layer every later feature depends on. A signed-in user creates a household (name only) and becomes its ADMIN. Admins invite people with single-use, 12-hour links that grant MEMBER or GUEST; the token travels in the URL fragment and is stored hashed. Members can be promoted, demoted, removed or can leave, under a shared "at least one admin" rule. Each member has a weight (0–100) that admins edit and everyone sees as a percentage. The API exposes a singular `/api/household` resource resolved from the caller. The weight math and the admin rule are pure functions in `packages/shared`. The web adds three screens: home states, settings, and the invite page.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`), Zod 4 (shared schemas), React 19, React Router 8, TanStack Query 5, react-i18next. New: `@radix-ui/react-dialog` in `packages/ui`.

**Storage**: PostgreSQL. New tables `households`, `memberships`, `invitations`, plus `users.removed_from_household`.

**Testing**: Vitest (shared, ui, web with Testing Library + MSW + axe), Supertest against `hogar_test` (api), Cypress with stubbed API (web e2e).

**Target Platform**: Web (modern evergreen browsers, mobile-first layouts); API on Render, web on Vercel behind a same-origin `/api` rewrite.

**Project Type**: Web application (pnpm monorepo: `apps/web`, `apps/api`, `packages/ui`, `packages/shared`).

**Performance Goals**: Interactive feel for a household of 2–10 people; every household request is a handful of indexed queries.

**Constraints**: Money-free feature, but weights use integer math only; tokens never logged or stored in readable form; no real time (refetch on focus); every string in `en` and `es`.

**Scale/Scope**: Households of up to ~10 members, ≤ 10 pending invitations each; 3 web screens, 13 endpoints, 3 new UI components.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Gate                                                                                                                                                                                                                                              | Status  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| I. Small, polished, deployed   | Scope matches the MVP item "household with invitations"; out-of-scope items listed in the spec; no extra packages or layers beyond one Radix primitive already in the family.                                                                     | ✅ Pass |
| II. Domain integrity           | One household per user by a unique `Membership.userId`; weights are integers 0–100; `weightsToBasisPoints` sums to exactly 10000 with leftovers to the first members; the logic lives in `packages/shared`.                                       | ✅ Pass |
| III. Server-side security      | Every endpoint resolves the caller's membership and role on the server; no household id from the client; ids are scoped to the caller's household; tokens are 256-bit, SHA-256 hashed, sent in bodies and not URLs; Zod validation on every body. | ✅ Pass |
| IV. Tested by default          | Unit tests for split and admin rule edge cases; Supertest for every endpoint × the permission matrix in `contracts/api.md`, including concurrency; ui components with axe and stories; Cypress for the main flows.                                | ✅ Pass |
| V. Fully internationalized     | New `household` namespace in `en`/`es`; 15 new error codes added to `ERROR_CODES` and `errors.json` (the parity test enforces it); percentages and times via `Intl`.                                                                              | ✅ Pass |
| VI. Warm and accessible design | Screens follow `docs/design.md`; warm copy for refusals ("make someone else admin first"); `Alert` pairs icon with text; Radix Dialog for focus management; light and dark checked.                                                               | ✅ Pass |
| Constraints                    | Allowed dependencies respected (`ui` gets no copy and doesn't import `shared`); CSS Modules with tokens; Prisma migration generated, not handwritten.                                                                                             | ✅ Pass |
| Workflow                       | Branch `feat/households`; spec, plan and tasks committed with the feature; Conventional Commits; PR with CI.                                                                                                                                      | ✅ Pass |

**Post-design re-check (after Phase 1):** ✅ Still passing. Design produced one spec change (R1: links can only be copied when created or renewed, because tokens are hashed), and it strengthens principle III rather than relaxing it.

## Project Structure

### Documentation (this feature)

```text
specs/001-households/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R14)
├── data-model.md        # Entities, states, invariants
├── quickstart.md        # How to validate end to end
├── contracts/
│   ├── api.md           # Endpoints, types, error codes, permission matrix
│   └── ui.md            # Routes, interactions, new ui components
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── household.ts            # roleSchema, name/weight/request schemas, view types
├── household.test.ts
├── split.ts                # weightsToBasisPoints
├── split.test.ts
├── permissions.ts          # checkAdminInvariant, role capabilities
├── permissions.test.ts
├── errors.ts               # + 15 error codes
└── index.ts                # re-exports

apps/api/
├── prisma/schema.prisma    # Household, Membership, Invitation, Role, User.removedFromHousehold
├── prisma/migrations/<ts>_households/migration.sql   # generated + weight CHECK
├── src/household/
│   ├── householdService.ts     # create, rename, leave, members, split, view building
│   ├── householdRouter.ts      # /api/household…
│   ├── invitationService.ts    # create/renew/revoke/list, lookup, accept (transactional)
│   ├── invitationRouter.ts     # /api/household/invitations… and /api/invitations…
│   └── loadMembership.ts       # resolves req.membership; requireAdmin
├── src/auth/tokens.ts          # reuse random token + SHA-256 helpers
├── src/me/meRouter.ts          # + DELETE /removal-notice
├── src/app.ts                  # mount routers (+ invitation rate limit)
└── test/
    ├── testApp.ts              # truncate new tables; helpers to sign in as several users
    ├── household.test.ts
    ├── members.test.ts
    ├── split.test.ts
    └── invitations.test.ts     # includes concurrent accept

packages/ui/src/components/
├── TextField/   (tsx, module.css, test, stories, mdx)
├── Dialog/      (tsx, module.css, test, stories, mdx)
└── Alert/       (tsx, module.css, test, stories, mdx)

apps/web/src/
├── api/client.ts               # household + invitation methods
├── household/useHousehold.ts   # query ["household"] + mutations
├── auth/guards.tsx             # keep `from` (path + hash) across login
├── pages/HomePage/             # no-household + household states, create dialog, removal note
├── pages/HouseholdSettingsPage/  # Name, Members (+ invitations), Split sections
├── pages/InvitePage/           # lookup states + join / leave-first
├── i18n/locales/{en,es}/household.json, errors.json
└── App.tsx                     # routes /household/settings, /invite

apps/web/cypress/e2e/household.cy.ts
```

**Structure Decision**: Follow the existing monorepo layout. API features live in folders by domain (`src/auth`, `src/me`, so `src/household`), with Supertest suites in `apps/api/test/`. Web pages each get a folder with tsx, CSS module and test, like `HomePage`. Reusable visuals go to `packages/ui`.

## Delivery order (each slice is shippable and tested)

1. **Shared:** schemas, error codes (plus `en`/`es` messages), `weightsToBasisPoints`, `checkAdminInvariant`.
2. **Data:** Prisma models, migration and test truncation.
3. **US1 · Create:** `GET`/`POST`/`PATCH /api/household`, the home page states, `TextField` and `Dialog`.
4. **US2 · Invite and join:** invitation endpoints, guards keeping `from`, `InvitePage`, the invitations section, `Alert`.
5. **US3 · Members:** role, remove, leave, removal notice, members section.
6. **US4 · Split:** `PUT /split`, banner, split section.
7. **E2E and polish:** Cypress flows, design checklist, README status row.

## Complexity Tracking

No constitution violations to justify.
