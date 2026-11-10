# Hogar Constitution

Hogar is a web app to manage a shared home (couple, family or flatmates): expenses with splits and
balances, chores and a shopping list, with real-time updates. It is a portfolio project for landing
a fullstack job, so code quality, tests, commit history and documentation matter as much as
features.

## Core Principles

### I. Small, Polished and Deployed

- Every feature MUST be finished end to end (API, web, tests, i18n, docs) and deployable before the
  next one starts. Something small, polished and deployed beats something big and half-done.
- Specs MUST stay within the current phase's scope (see _Scope_). Out-of-scope ideas are recorded
  as future work, not implemented.
- Prefer the simplest design that meets the acceptance criteria; any extra package, layer or
  abstraction MUST be justified in the plan's Complexity Tracking table.

**Rationale:** recruiters and reviewers judge finished, working software and the care behind it,
not the length of a feature list.

### II. Domain Integrity (NON-NEGOTIABLE)

- **Money is integer cents (`Int`).** `float` and `Decimal` are never used in logic; amounts are
  formatted only when displayed. Currency is always EUR.
- **Percentages are basis points:** 10000 = 100 %.
- **Splits always add up:** the sum of the shares is exactly the total; leftover cents go
  deterministically to the first members.
- **Balances are never stored:** they are computed from `ExpenseShare` and `Settlement`.
- **A user belongs to a single household**, enforced by a unique `Membership.userId`.
- **Household type** (`COUPLE_FAMILY` / `SHARED_FLAT`) only changes defaults, never logic.
- Split, balance and debt-simplification logic lives in `packages/shared` so web and API compute
  the same results.

**Rationale:** the app exists to reduce tension around money; a single cent of drift or a
disagreeing balance destroys that trust.

### III. Server-Side Security

- Every endpoint MUST check household membership and role on the server. The frontend only hides
  buttons; that is never a security measure.
- **Roles:** `ADMIN` (everything, including managing members), `MEMBER` (create and edit content),
  `GUEST` (read only). A household is never left without an admin.
- Passwords, refresh tokens and invitation tokens are never stored in plain text; they are hashed.
- Authentication follows `docs/decisions/0002-authentication.md`: a Google Identity Services ID
  token verified by the API, a 15-minute JWT kept in memory on the web, and a rotating, hashed
  refresh token in an httpOnly cookie scoped to `/api/auth`.
- All API input MUST be validated with the Zod schemas from `packages/shared`, the same ones the
  forms use.

**Rationale:** a shared home mixes people with different levels of trust (flatmates, guests);
access rules must hold no matter which client calls the API.

### IV. Tested by Default

- All domain logic (splits, balances, debt simplification, permissions) MUST have unit tests,
  including edge cases (rounding, single member, zero amounts, removed members).
- Every endpoint MUST have Supertest tests, including role permission tests: what happens when a
  `GUEST` or someone from another household tries it.
- Every `packages/ui` component MUST have a test (including axe) and a Storybook story.
- Main user flows MUST have Cypress E2E tests; a second real-time user is simulated with API calls
  inside the test.
- A task is not done if format, lint, typecheck or tests fail.

**Rationale:** tests are both the safety net for money logic and the clearest evidence of
engineering quality in a portfolio.

### V. Fully Internationalized

- Supported locales are `en` and `es`; detection order is stored preference → `navigator.languages`
  → fallback `en`, with `<html lang>` kept in sync.
- There is no hardcoded user-facing copy: every string goes through i18n, with semantic,
  dot-separated keys per feature namespace. `en` is the source of truth and keys are typed, so a
  missing key is a type error.
- Zod schemas and the API return **error codes**, never sentences; the web translates them. Only
  server-rendered text (invitation emails) is localized on the server.
- `packages/ui` contains no copy: every visible or accessible string comes in through props.
- Money, dates and numbers are always formatted with `Intl` and the active locale.
- Every spec that adds UI MUST list its new keys in both locales; the parity test keeps `en` and
  `es` identical in keys with no empty values.

**Rationale:** bilingual from day one keeps copy out of logic and makes the app usable by the
people it is built for.

### VI. Warm and Accessible Design

- Before any change that touches the interface, `docs/design.md` is read and its checklist is run
  before calling the task done. Conflicts with the guide are raised, not ignored.
- The goal is **warmth and comfort**: the interface and its copy lower tension around money and
  chores ("Ana owes you €12.50" / "Ana te debe 12,50 €").
- Styles use only semantic tokens (`--color-*`, `--space-*`…), never primitives or raw values.
- Everything works in light and dark themes with AA contrast; color never carries meaning on its
  own. The brand palette applies everywhere, Storybook included.
- Semantic HTML, visible focus and ARIA roles where needed.
- Every component documents, in bilingual Storybook docs, why it is designed that way and how it
  helps the person using it.

**Rationale:** money and chores are emotionally loaded topics; a calm, inclusive interface is the
product's main differentiator.

## Technology and Architecture Constraints

- **Monorepo:** pnpm workspaces (no Turborepo or Nx). Layout: `apps/web`, `apps/api`, `packages/ui`,
  `packages/shared`, `docs/`.
- **Allowed dependencies:** `web → ui, shared` and `api → shared`. `ui` never imports from
  `shared` or the apps, and `web` never imports from `api`.
- **Web:** React, Vite, React Router, TanStack Query, react-i18next. **Styles:** CSS Modules with
  tokens and `clsx` variants; no Tailwind, no CSS-in-JS.
- **Design system:** custom components in `packages/ui`, each in its own folder with
  `Component.tsx`, `.module.css`, `.test.tsx`, `.stories.tsx` and a bilingual `.mdx` docs page.
- **API:** Node, Express, TypeScript, REST. **Data:** PostgreSQL with Prisma 7.
- **Real time:** Socket.io with one room per household; events typed in `packages/shared`.
- **TypeScript:** strict everywhere, pinned to 6.0 until typescript-eslint supports 7.x; no `any`
  unless justified in a comment.
- **Testing:** Vitest + Testing Library, Supertest, Cypress.
- **Infra:** Docker Compose locally, GitHub Actions CI, Vercel (web and Storybook), Render (API),
  Neon (Postgres).
- **Language:** code, identifiers, comments, docs, specs, test names and commit messages are in
  English.

## Scope

- **Current phase, MVP (v1):** auth and roles, household with invitations, expenses with splits and
  balances, chores with an assignee, shopping list, and real time.
- **Out of the MVP:** recurring expenses and recurring chores (v1.1), budgets and charts (v1.2).
- **Out of scope:** multiple households per user, real payments, multiple currencies, native
  mobile app, and gamification. They are not implemented unless explicitly requested and the
  constitution is amended.
- **Open decision:** for couple/family households, proportional split (already supported with
  `Membership.defaultShareBps`) or a shared pot. Any spec that depends on it MUST resolve it via
  `/speckit-clarify` and record it in `docs/decisions/`.

## Development Workflow

- **Spec-driven:** each feature goes `/speckit-specify` → (`/speckit-clarify`) → `/speckit-plan` →
  `/speckit-tasks` → (`/speckit-analyze`) → `/speckit-implement`. Specs live in
  `specs/NNN-feature/` and are committed with the feature.
- **Branches:** one branch per feature and a PR to `main`. CI (format, lint, typecheck, tests with
  Postgres, builds, Cypress) MUST pass before merging.
- **Commits:** small, Conventional Commits in English (`feat(api): add expense split endpoint`).
  No AI attribution: no `Co-Authored-By` trailers and no "Generated with" footers.
- **Decisions:** significant architectural choices are recorded as ADRs in `docs/decisions/`.

## Governance

- This constitution supersedes other practices. `CLAUDE.md` holds day-to-day runtime guidance
  (commands, conventions, environment notes) and MUST NOT contradict it.
- Every plan's Constitution Check MUST evaluate each principle above; violations are either fixed
  or justified in Complexity Tracking. Reviews and `/speckit-analyze` verify compliance.
- Amendments are made through `/speckit-constitution` in their own PR, with a semantic version
  bump: MAJOR for removed or redefined principles, MINOR for new principles or sections, PATCH for
  clarifications.

**Version**: 1.0.0 | **Ratified**: 2026-11-10 | **Last Amended**: 2026-11-10
