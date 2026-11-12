# Hogar

Web app to manage a shared home (couple, family or flatmates): expenses with splits and balances, chores and a shopping list, with real-time updates. It is a portfolio project for landing a fullstack job, so code quality, tests, commit history and documentation matter as much as features.

This file holds the project rules. Rules marked MUST are non-negotiable. Change them only in their own PR with a version bump (MAJOR: a rule removed or redefined; MINOR: a new rule or section; PATCH: a clarification), plus an ADR when the change is a significant decision.

**Before exploring code,** read [GLOSSARY.md](GLOSSARY.md) and the ADRs in [docs/adr/](docs/adr/) that touch the area. Use the glossary's terms in issues, code and tests. If something you propose contradicts an ADR, say so explicitly instead of silently overriding it.

## How features are built

Features follow Matt Pocock's grill-driven flow ([mattpocock-skills](https://github.com/mattpocock/skills) plugin, installed per developer and not vendored in the repo):

1. **Branch** from `main`: `feat/<name>`, `fix/<name>` or `chore/<name>`.
2. **`/grill-with-docs`**: interview until there is a shared understanding. Resolved terms go to `GLOSSARY.md` and hard-to-reverse decisions to `docs/adr/`, as they happen.
3. **`/prototype`** only when a question needs running code to answer.
4. **`/to-spec`** publishes the spec as a GitHub issue; **`/to-tickets`** splits it into vertical-slice sub-issues with their blocking edges. Keep steps 2–4 in one context window.
5. **`/implement`** one ticket per fresh context (or **`/implement-spec`** for the whole spec). Both drive **`/tdd`** and finish with **`/code-review`**.
6. **PR** to `main` (**`/pr`** shapes the body) that closes its issues. Then **`/retro`** to improve the environment, not the code.

Every spec MUST state in its Implementation Decisions how it meets the rules below, justify any exception there, and, if it adds UI, list its new i18n keys in both locales.

## I. Small, polished and deployed

- Every feature MUST be finished end to end (API, web, tests, i18n, docs) and deployable before the next one starts. Something small, polished and deployed beats something big and half-done.
- Specs MUST stay within the current phase's scope (see _Scope_). Out-of-scope ideas are recorded as future work, not implemented.
- Prefer the simplest design that meets the acceptance criteria; any extra package, layer or abstraction MUST be justified in the spec.

**Why:** recruiters and reviewers judge finished, working software and the care behind it, not the length of a feature list.

## II. Domain integrity (non-negotiable)

- **Money is integer cents (`Int`).** `float` and `Decimal` are never used in logic; amounts are formatted only when displayed. Currency is always EUR.
- **Percentages are basis points:** 10000 = 100 %.
- **Splits always add up:** the sum of the shares is exactly the total; leftover cents go deterministically to the first members.
- **Balances are never stored:** they are computed from `ExpenseShare` and `Settlement`.
- **A user belongs to a single household**, enforced by a unique `Membership.userId`.
- **Default split by weight:** each `Membership` has an integer `weight` (0–100) and a household's default split is proportional to those weights, converted to exact cents with the rule above. There is no household type: one model covers couples, families and flatmates (ADR 0003).
- **Category splits extend the default:** an expense category MAY opt in to its own weight (0–100) per member, which replaces the household's weights as the default split for expenses in that category. Only `ADMIN` manages categories and their weights (ADR 0005).
- **Shares are fixed when saved:** changing weights, categories or members never changes an existing expense; its shares change only when someone edits that expense and sees the new shares before saving.
- Split, balance and debt-simplification logic lives in `packages/shared` so web and API compute the same results.

**Why:** the app exists to reduce tension around money; a single cent of drift or a disagreeing balance destroys that trust.

## III. Server-side security

- Every endpoint MUST check household membership and role on the server. The frontend only hides buttons; that is never a security measure.
- **Roles:** `ADMIN` (everything, including managing members), `MEMBER` (create and edit content), `GUEST` (read only). A household is never left without an admin.
- Passwords, refresh tokens and invitation tokens are never stored in plain text; they are hashed.
- Authentication follows ADR 0002: a Google Identity Services ID token verified by the API, a 15-minute JWT kept in memory on the web, and a rotating, hashed refresh token in an httpOnly cookie scoped to `/api/auth`.
- All API input MUST be validated with the Zod schemas from `packages/shared`, the same ones the forms use.

**Why:** a shared home mixes people with different levels of trust (flatmates, guests); access rules must hold no matter which client calls the API.

## IV. Tested by default

- All domain logic (splits, balances, debt simplification, permissions) MUST have unit tests, including edge cases (rounding, single member, zero amounts, removed members).
- Every endpoint MUST have Supertest tests, including role permission tests: what happens when a `GUEST` or someone from another household tries it.
- Every `packages/ui` component MUST have a test (including axe) and a Storybook story.
- Main user flows MUST have Cypress E2E tests; a second real-time user is simulated with API calls inside the test.
- A task is not done if format, lint, typecheck or tests fail.

**Why:** tests are both the safety net for money logic and the clearest evidence of engineering quality in a portfolio.

## V. Fully internationalized

- Supported locales are `en` and `es`; detection order is stored preference → `navigator.languages` → fallback `en`, with `<html lang>` kept in sync.
- There is no hardcoded user-facing copy: every string goes through i18n, with semantic, dot-separated keys per feature namespace. `en` is the source of truth and keys are typed, so a missing key is a type error.
- Zod schemas and the API return **error codes**, never sentences; the web translates them. The server renders no user-facing text; if it ever does (e.g. invitation emails), it is localized with `User.locale`, falling back to `Accept-Language`.
- `packages/ui` contains no copy: every visible or accessible string comes in through props.
- Money, dates and numbers are always formatted with `Intl` and the active locale.
- The parity test keeps `en` and `es` identical in keys with no empty values.

**Why:** bilingual from day one keeps copy out of logic and makes the app usable by the people it is built for.

## VI. Joyful and accessible design

- Before any change that touches the interface, read [docs/design.md](docs/design.md) and run its checklist before calling the task done. Conflicts with the guide are raised, not ignored.
- The goal is **joyful and approachable**: a young, energetic interface with one vivid brand color used deliberately, while the interface and its copy still lower tension around money and chores ("Ana owes you €12.50" / "Ana te debe 12,50 €").
- Styles use only semantic tokens (`--color-*`, `--space-*`…), never primitives or raw values.
- Everything works in light and dark themes with AA contrast; color never carries meaning on its own. The brand palette applies everywhere, Storybook included.
- Semantic HTML, visible focus and ARIA roles where needed.
- Every component documents, in bilingual Storybook docs, why it is designed that way and how it helps the person using it.

**Why:** money and chores are emotionally loaded topics; a joyful, approachable and inclusive interface makes them feel lighter and is the product's main differentiator.

## Technology and architecture

- **Monorepo:** pnpm workspaces (no Turborepo or Nx): `apps/web`, `apps/api`, `packages/ui`, `packages/shared`, `docs/`.
- **Allowed dependencies:** `web → ui, shared` and `api → shared`. `ui` never imports from `shared` or the apps, and `web` never imports from `api`.
- **Web:** React, Vite, React Router, TanStack Query, react-i18next. A client-only SPA: no SSR, `React.lazy` for code splitting. **Styles:** CSS Modules with tokens and `clsx` variants; no Tailwind, no CSS-in-JS.
- **Design system:** custom components in `packages/ui`, each in its own folder with `Component.tsx`, `.module.css`, `.test.tsx`, `.stories.tsx` and a bilingual `.mdx` docs page.
- **API:** Node, Express, TypeScript, REST. **Data:** PostgreSQL with Prisma 7.
- **Real time:** Socket.io with one room per household; events typed in `packages/shared`.
- **TypeScript:** strict everywhere, pinned to 6.0 until typescript-eslint supports 7.x; no `any` unless justified in a comment.
- **Testing:** Vitest + Testing Library, Supertest, Cypress.
- **Infra:** Docker Compose locally, GitHub Actions CI, Vercel (web and Storybook), Render (API), Neon (Postgres). Vercel rewrites `/api/*` to Render so the browser sees one origin; see [docs/deploy.md](docs/deploy.md).
- **Language:** code, identifiers, comments, docs, issues, test names and commit messages are in English.

Package guidance loads on demand from `apps/web/CLAUDE.md` (i18n) and `packages/ui/CLAUDE.md` (components and Storybook).

## Scope

- **Current phase, MVP (v1):** auth and roles, household with shareable-link invitations, expenses with splits and balances, expense categories (with an optional own split and a list filter), chores with an assignee, shopping list, and real time.
- **Out of the MVP:** invitation emails, recurring expenses and recurring chores (v1.1), budgets and charts, including totals and charts per category (v1.2).
- **Out of scope:** multiple households per user, a shared pot, real payments, multiple currencies, native mobile app, and gamification. They are not implemented unless explicitly requested and these rules are amended.

## Git workflow

- One branch per feature and a PR to `main`. CI (format, lint, typecheck, tests with Postgres, builds, Cypress) MUST pass before merging. Once merged, the branch MUST be deleted on GitHub (`git push origin --delete <branch>`) and locally (`git branch -d <branch>`, then `git fetch --prune`).
- Small Conventional Commits in English (`feat(api): add expense split endpoint`). No AI attribution: no `Co-Authored-By` trailers and no "Generated with" footers.

## Agent skills

- **Issue tracker:** GitHub Issues on this repo, through the `gh` CLI. Specs are issues; tickets are sub-issues with native "blocked by" dependencies. External PRs are not treated as requests.
- **Triage labels:** the defaults, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`.
- **Domain docs:** single context: `GLOSSARY.md` at the root and ADRs in `docs/adr/`. If either is missing a term or decision, `/domain-modeling` adds it lazily; don't create them upfront.

## Commands

Standard scripts live in the root `package.json`. Non-obvious bits:

- Database: `pnpm db:up` (Docker; needs WSL on Windows). API tests need Postgres with a `hogar_test` database.
- E2E: `pnpm --filter @hogar/web e2e` (own Vite on :5174, API and Google stubbed). If Cypress says "bad option: --smoke-test", unset `ELECTRON_RUN_AS_NODE`.
- Env files: copy `apps/api/.env.example` and `apps/web/.env.example` to `.env`; Google setup in `docs/setup-google-oauth.md`.
- Deploy: `docs/deploy.md` (`render.yaml`, `apps/web/vercel.json`, `packages/ui/vercel.json`). API production build: `pnpm --filter @hogar/api build`.

**Version**: 4.0.0 | **Ratified**: 2026-11-10 | **Last Amended**: 2026-11-12
