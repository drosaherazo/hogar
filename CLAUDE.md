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
3. `/speckit-clarify` when anything is ambiguous.
4. `/speckit-plan` → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, gated by the Constitution Check.
5. `/speckit-tasks` → `tasks.md`; optionally `/speckit-analyze` to cross-check spec, plan and tasks.
6. `/speckit-implement`, then `/speckit-converge` until it reports converged.

Unsure which step comes next? `/sdd-help` explains every speckit skill and inspects the active feature to suggest the next command.

Specs replace the old idea of a single `docs/product.md`. Do not edit the vendored files in `.specify/templates`, `.specify/scripts` or `.claude/skills/speckit-*` by hand (they are excluded from Prettier and get replaced on upgrade); customize through presets or the constitution instead. Upgrading: `uv tool install --force --python 3.13 specify-cli --from git+https://github.com/github/spec-kit.git@<tag>`, then `specify init --here --force --non-interactive --integration claude --script ps` and review the diff.

## React performance

The vendored `vercel-react-best-practices` skill (from `vercel-labs/agent-skills`, MIT; refresh by re-copying its `skills/react-best-practices` folder) applies to React code in `apps/web` and `packages/ui`, with three adjustments: both are client-only Vite code, so skip the Next.js/SSR rules (`server-*`, `async-api-routes`, `rendering-hydration-*`); use `React.lazy` instead of `next/dynamic`; and data fetching uses TanStack Query, not SWR. The constitution and `docs/design.md` win on any conflict.

## UI/UX design

The vendored `ui-ux-pro-max` skill (from `nextlevelbuilder/ui-ux-pro-max-skill`, MIT; refresh by re-copying its `.claude/skills/ui-ux-pro-max` folder) helps with UI decisions and reviews in `apps/web` and `packages/ui`. Its search script needs Python 3 and no dependencies; run it from the repo root as `python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>`, because the `${CLAUDE_PLUGIN_ROOT}` path in its `SKILL.md` only works for plugin installs. Adjustments: use `--stack react`; ignore Tailwind, shadcn and Next.js suggestions (styles are CSS Modules with semantic tokens); and never use its palettes or fonts in place of the brand tokens. Its output feeds the `docs/design.md` checklist rather than replacing it. The constitution and `docs/design.md` win on any conflict.

## Design review

The vendored `web-design-guidelines` skill (from `vercel-labs/agent-skills`, MIT; refresh by re-copying its `skills/web-design-guidelines` folder) audits UI code in `apps/web` and `packages/ui` against Vercel's Web Interface Guidelines. It fetches those rules live from `vercel-labs/web-interface-guidelines` on every run, so they can change upstream without a repo change. Its findings add to the `docs/design.md` checklist and never replace it; the constitution and `docs/design.md` (semantic tokens only, no hardcoded copy, warmth) win on any conflict.

## Deploy

Vercel rewrites `/api/*` to the API on Render (bundled with esbuild) so the browser sees one origin; Postgres on Neon. See `docs/deploy.md`.

Package-specific guidance loads on demand from `apps/web/CLAUDE.md` (i18n) and `packages/ui/CLAUDE.md` (components and Storybook).

## Commands

Standard scripts live in the root `package.json`. Non-obvious bits:

- Database: `pnpm db:up` (Docker; needs WSL on Windows). API tests need Postgres with a `hogar_test` database.
- E2E: `pnpm --filter @hogar/web e2e` (own Vite on :5174, API and Google stubbed). If Cypress says "bad option: --smoke-test", unset `ELECTRON_RUN_AS_NODE`.
- Env files: copy `apps/api/.env.example` and `apps/web/.env.example` to `.env`; Google setup in `docs/setup-google-oauth.md`.
- Deploy: `docs/deploy.md` (`render.yaml`, `apps/web/vercel.json`, `packages/ui/vercel.json`). API production build: `pnpm --filter @hogar/api build`.
