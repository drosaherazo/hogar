# Hogar

Web app to manage a shared home (couple, family or flatmates): expenses with splits and balances, chores and a shopping list, with real-time updates.

This is a **portfolio project for landing a fullstack job**. Code quality, tests, commit history and the README matter as much as features. Always prefer something small, polished and deployed over something big and half-done.

The full product document (user stories and acceptance criteria per phase) will live in `docs/product.md` (not written yet).

## Stack

- **Monorepo:** pnpm workspaces, no Turborepo or Nx for now.
- **Frontend (`apps/web`):** React, Vite, TypeScript, React Router, TanStack Query, react-i18next.
- **TypeScript 6.0** everywhere until typescript-eslint supports 7.x.
- **Styles:** CSS Modules. No Tailwind, no CSS-in-JS.
- **Design system (`packages/ui`):** custom components with Storybook.
- **Backend (`apps/api`):** Node, Express, TypeScript, REST API.
- **Data:** PostgreSQL with Prisma 7 (`prisma.config.ts`, `@prisma/adapter-pg`, client generated to `apps/api/src/generated` on install). Schema in `apps/api/prisma/schema.prisma`.
- **Real time:** Socket.io, one room per household.
- **Shared validation and types (`packages/shared`):** Zod schemas and types used by web and api.
- **Auth:** Google Identity Services ID token verified by the API → 15-minute JWT (kept in memory on the web) + rotating, hashed refresh token in an httpOnly cookie scoped to `/api/auth`. See `docs/decisions/0002-authentication.md`.
- **Testing:** Vitest + Testing Library (unit), Supertest (API), Cypress (E2E).
- **Infra:** Docker Compose locally, GitHub Actions, Vercel (web and Storybook), Render or Fly.io (API and database).

## Structure

```
apps/
  web/      React
  api/      Express + Prisma
packages/
  ui/       design system + Storybook
  shared/   types, Zod schemas, split logic
docs/       product, data model, decisions, design guide
```

Allowed dependencies: `web → ui, shared` and `api → shared`. `ui` never imports from `shared` or the apps, and `web` never imports from `api`.

## Domain rules

- **Money in cents (`Int`)**, never `float` or `Decimal` in logic. Format only when displaying.
- **Percentages in basis points:** 10000 = 100 %.
- **Splits always add up:** the sum of the shares is exactly the total; leftover cents go deterministically to the first members.
- **Balances are never stored:** they are computed from `ExpenseShare` and `Settlement`.
- **A user belongs to a single household** (enforced by a unique `Membership.userId`).
- **Roles:** `ADMIN` (everything, including managing members), `MEMBER` (create and edit content), `GUEST` (read only). A household is never left without an admin.
- **Permissions on the server:** every endpoint checks household membership and role. The frontend only hides buttons; that is not a security measure.
- **Hashed secrets:** passwords, refresh tokens and invitation tokens are never stored in plain text.
- **Household type** (`COUPLE_FAMILY` / `SHARED_FLAT`) only changes defaults, never logic.

## Language policy

- **Code, identifiers, comments, documentation, test names and commit messages: English.**
- **All user-facing text goes through i18n.** No hardcoded copy anywhere in the UI. Supported locales: `en` and `es`.
- Documentation that cannot be internationalized (README, `docs/`, this file) is written in English.
- **Storybook is fully bilingual** and follows its **Locale** toolbar: MDX prose wrapped in `<Lang locale="en">` / `<Lang locale="es">`, docs blocks take `{ en, es }` values, stories get copy per locale. Only sidebar titles stay in English. See _Foundations › Documenting a component_.

## i18n

- **Locales:** `en`, `es`. Detection order: stored user preference → `navigator.languages` → fallback `en`. Keep `<html lang>` in sync.
- **Translations:** `apps/web/src/i18n/locales/{en,es}/<namespace>.json`, one namespace per feature (`common`, `auth`, `household`, `expenses`, `tasks`, `shopping`). `en` is the source of truth; keys are typed through i18next module augmentation, so a missing key is a type error.
- **Keys:** semantic and dot-separated by feature (`expenses.empty.title`), never the English sentence. Plurals with i18next `_one` / `_other`; names and amounts through interpolation.
- **Formatting:** money, dates and numbers always with `Intl` and the active locale. Currency is always EUR.
- **`packages/ui` has no copy.** Every visible or accessible string (labels, `aria-label`, empty-state text) comes in via props, required when needed for accessibility. `ui` exposes `LocaleProvider` / `useLocale()` only for formatting components.
- **Zod schemas return error codes** (`expense.amount.positive`), not sentences; `web` translates them with a Zod error map.
- **The API returns error codes**, never user-facing sentences. Only server-rendered text (invitation emails) is localized, using `User.locale` with `Accept-Language` as fallback.
- **Tests:** a test asserts that `en` and `es` have exactly the same keys and no empty values. ESLint uses `eslint-plugin-i18next` (`no-literal-string`) on JSX in `web` and `ui`.
- Setup lives in `apps/web/src/i18n/` (`createI18n`, `useLocalePreference`); the parity test is `i18n.test.ts` and also checks that every API error code has a message.

## Code conventions

- Strict TypeScript across the monorepo; no `any` unless justified in a comment.
- API input validation with the Zod schemas from `packages/shared`, the same ones the forms use.
- **CSS Modules:** every component in its own folder with `Component.tsx`, `Component.module.css`, `Component.test.tsx`, `Component.stories.tsx` and a bilingual `Component.mdx` docs page (`Button` is the reference). Styles use only tokens (`var(--color-…)`, `var(--space-…)`), never raw values. Variants with `clsx`.
- **Accessibility:** semantic HTML, visible focus, ARIA roles where needed and AA contrast.
- Socket.io events typed in `packages/shared`.

## Design

**Before any task that touches the interface** (components, screens, styles or copy), read `docs/design.md` and run its checklist before calling the task done. If a request conflicts with the guide, say so and propose an alternative instead of ignoring it.

Non-negotiables:

- Goal: **warmth and comfort**; the interface lowers tension around money and chores.
- Only semantic tokens (`--color-*`, `--space-*`…), never primitives or raw values.
- Everything works and is reviewed in light and dark themes, with AA contrast (checked in `packages/ui/src/tokens/tokens.test.ts`).
- Color never carries meaning on its own.
- The brand palette is used **everywhere**, Storybook included: its chrome, docs and canvas use the light/dark brand themes in `packages/ui/.storybook/themes.ts`, switched together by the Theme toolbar and kept in sync with `primitives.css` by `storybookThemes.test.ts`.
- Warm, natural copy in every language ("Ana owes you €12.50" / "Ana te debe 12,50 €").
- Every component documents why it is designed that way and how it helps the person using it.

The full rationale for each decision lives in Storybook, under Foundations (`packages/ui/src/docs/`).

## Tests

- All domain logic (splits, balances, debt simplification, permissions) has unit tests, including edge cases.
- Every endpoint has Supertest tests, including role permission tests (what happens if a `GUEST` or someone from another household tries it).
- Every `packages/ui` component has a test and a Storybook story.
- Cypress E2E for the main flows. To simulate a second real-time user, use API calls inside the test.
- A task is not done if lint, typecheck or tests fail.

## Git

- Small commits with Conventional Commits in English: `feat(api): add expense split endpoint`.
- No AI attribution: commits have no `Co-Authored-By` trailer and PR descriptions have no "Generated with" footer.
- One branch per feature and a PR to `main`; CI (`.github/workflows/ci.yml`: format, lint, typecheck, tests with Postgres, builds, Cypress) must pass before merging.

## Scope

Current phase: **MVP (v1)** — auth and roles, household with invitations, expenses with splits and balances, chores with an assignee, shopping list and real time.

Out of the MVP: recurring expenses and recurring chores (v1.1), budgets and charts (v1.2). Out of scope: multiple households per user, real payments, multiple currencies, native mobile app and gamification. Do not implement them unless asked.

Open decision: for couple/family households, proportional split (already supported with `Membership.defaultShareBps`) or a shared pot.

## Commands

- Install: `pnpm install` (also generates the Prisma client)
- Database: `pnpm db:up` (Docker; needs WSL on Windows) · `pnpm db:migrate` · `pnpm db:down`
- Run web + API: `pnpm dev` (web on :5173, proxies `/api` to the API on :3000)
- Checks: `pnpm lint` · `pnpm typecheck` · `pnpm test` (API tests need Postgres with `hogar_test`)
- E2E: `pnpm --filter @hogar/web e2e` (own Vite on :5174, API and Google stubbed). If Cypress says "bad option: --smoke-test", unset `ELECTRON_RUN_AS_NODE`.
- Storybook: `pnpm storybook`
- Env files: copy `apps/api/.env.example` and `apps/web/.env.example` to `.env`; Google setup in `docs/setup-google-oauth.md`.
