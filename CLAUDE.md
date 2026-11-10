# Hogar

Web app to manage a shared home (couple, family or flatmates): expenses with splits and balances, chores and a shopping list, with real-time updates. Portfolio project for landing a fullstack job.

## Constitution

The non-negotiable rules (product principles, domain rules, security, testing, i18n, design, stack constraints, scope and Git workflow) live in the **project constitution**, imported here so it is always in context:

@.specify/memory/constitution.md

This file only adds day-to-day guidance and must never contradict the constitution. To change a rule, amend the constitution with `/speckit-constitution` (semver bump, own PR).

## Spec-Driven Development

Features are built with [GitHub Spec Kit](https://github.com/github/spec-kit) (v1.3.3, Claude skills in `.claude/skills/speckit-*`, scripts in PowerShell).

1. Create the feature branch first (`git switch -c feat/<name>` from `main`); Spec Kit does not create branches.
2. `/speckit-specify <what and why>` → writes `specs/NNN-<name>/spec.md` (user stories and acceptance criteria; no tech details).
3. `/speckit-clarify` when anything is ambiguous (always for the open split/shared-pot decision).
4. `/speckit-plan` → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, gated by the Constitution Check.
5. `/speckit-tasks` → `tasks.md`; optionally `/speckit-analyze` to cross-check spec, plan and tasks.
6. `/speckit-implement`, then `/speckit-converge` until it reports converged.

Specs replace the old idea of a single `docs/product.md`. Do not edit the vendored files in `.specify/templates`, `.specify/scripts` or `.claude/skills/speckit-*` by hand (they are excluded from Prettier and get replaced on upgrade); customize through presets or the constitution instead. Upgrading: `uv tool install --force --python 3.13 specify-cli --from git+https://github.com/github/spec-kit.git@<tag>`, then `specify init --here --force --non-interactive --integration claude --script ps` and review the diff.

## Stack details

- **Prisma 7:** `prisma.config.ts`, `@prisma/adapter-pg`, client generated to `apps/api/src/generated` on install. Schema in `apps/api/prisma/schema.prisma`.
- **Auth:** see `docs/decisions/0002-authentication.md`.
- **Deploy:** Vercel rewrites `/api/*` to the API on Render (bundled with esbuild) so the browser sees one origin; Postgres on Neon. See `docs/deploy.md`.

## i18n implementation

- Translations: `apps/web/src/i18n/locales/{en,es}/<namespace>.json`, one namespace per feature (`common`, `auth`, `household`, `expenses`, `tasks`, `shopping`). Keys are typed through i18next module augmentation.
- Keys like `expenses.empty.title`; plurals with i18next `_one` / `_other`; names and amounts through interpolation.
- `packages/ui` exposes `LocaleProvider` / `useLocale()` only for formatting components.
- `web` translates Zod error codes with a Zod error map. Invitation emails use `User.locale` with `Accept-Language` as fallback.
- Setup lives in `apps/web/src/i18n/` (`createI18n`, `useLocalePreference`). `i18n.test.ts` checks `en`/`es` key parity, no empty values, and that every API error code has a message. ESLint runs `eslint-plugin-i18next` (`no-literal-string`) on JSX in `web` and `ui`.

## Components and Storybook

- `Button` is the reference component for folder layout, tests, stories and docs.
- Storybook is fully bilingual and follows its **Locale** toolbar: MDX prose wrapped in `<Lang locale="en">` / `<Lang locale="es">`, docs blocks take `{ en, es }` values, stories get copy per locale. Only sidebar titles stay in English. See _Foundations › Documenting a component_.
- Storybook chrome, docs and canvas use the light/dark brand themes in `packages/ui/.storybook/themes.ts`, switched together by the Theme toolbar and kept in sync with `primitives.css` by `storybookThemes.test.ts`. AA contrast is checked in `packages/ui/src/tokens/tokens.test.ts`.
- The full design rationale lives in Storybook under Foundations (`packages/ui/src/docs/`); the rules and checklist in `docs/design.md`.

## Commands

- Install: `pnpm install` (also generates the Prisma client)
- Database: `pnpm db:up` (Docker; needs WSL on Windows) · `pnpm db:migrate` · `pnpm db:down`
- Run web + API: `pnpm dev` (web on :5173, proxies `/api` to the API on :3000)
- Checks: `pnpm format:check` · `pnpm lint` · `pnpm typecheck` · `pnpm test` (API tests need Postgres with `hogar_test`)
- E2E: `pnpm --filter @hogar/web e2e` (own Vite on :5174, API and Google stubbed). If Cypress says "bad option: --smoke-test", unset `ELECTRON_RUN_AS_NODE`.
- Storybook: `pnpm storybook`
- Env files: copy `apps/api/.env.example` and `apps/web/.env.example` to `.env`; Google setup in `docs/setup-google-oauth.md`.
- Deploy: `docs/deploy.md` (`render.yaml`, `apps/web/vercel.json`, `packages/ui/vercel.json`). API production build: `pnpm --filter @hogar/api build`.
