# Hogar

**A warm, shared home organizer** for couples, families and flatmates: split expenses and see who owes whom, share chores and keep one shopping list, with real-time updates.

> Portfolio project. The goal is something small, polished and deployed: tested code, a documented design system and a clean commit history.

## Status

| Area                                                                | State                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| Design system (`packages/ui`)                                       | ✅ Tokens, light/dark themes, 7 components, bilingual Storybook |
| Sign in with Google                                                 | ✅ API + web, rotating refresh tokens                           |
| Home page                                                           | ✅ Welcome + "no household yet"                                 |
| Households, invitations, expenses, chores, shopping list, real time | 🔜 Next (MVP)                                                   |

## Stack

- **Monorepo:** pnpm workspaces
- **Web (`apps/web`):** React, Vite, React Router, TanStack Query, react-i18next (English and Spanish)
- **API (`apps/api`):** Node, Express 5, Prisma 7, PostgreSQL
- **Design system (`packages/ui`):** CSS Modules, design tokens, Radix primitives, Storybook
- **Shared (`packages/shared`):** Zod schemas, types and error codes used by web and API
- **Testing:** Vitest, Testing Library, axe, MSW, Supertest, Cypress
- **TypeScript 6.0**, strict everywhere

## Getting started

Requirements: **Node 24**, **pnpm 11**, and **Docker** for PostgreSQL (on Windows, Docker Desktop needs WSL: `wsl --install` in an admin terminal, then restart).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in the Google Client ID in both `.env` files and a `JWT_ACCESS_SECRET` in the API one. Follow **[docs/setup-google-oauth.md](docs/setup-google-oauth.md)**; it takes about ten minutes.

```bash
pnpm db:up       # PostgreSQL 17 in Docker (databases hogar and hogar_test)
pnpm db:migrate  # apply Prisma migrations
pnpm dev         # web on http://localhost:5173, API on http://localhost:3000
```

## Scripts

| Command                                           | What it does                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                        | Web and API in watch mode (Vite proxies `/api` to the API)              |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`      | Checks across every package                                             |
| `pnpm --filter @hogar/web e2e`                    | Cypress flows against a separate Vite instance (API and Google stubbed) |
| `pnpm storybook`                                  | Design system docs on http://localhost:6006                             |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:migrate` | Database lifecycle                                                      |
| `pnpm format`                                     | Prettier                                                                |

## How it's built

- **Warm by design.** Every color, shape and piece of copy aims to lower the tension of talking about money and chores. The reasoning, in English and Spanish, lives in Storybook (_Foundations_ and each component's docs page); the rules and review checklist are in [docs/design.md](docs/design.md).
- **Accessible by default.** AA contrast is enforced by tests in both themes, every component is tested with axe, and color never carries meaning on its own.
- **Fully internationalized.** No hardcoded copy (ESLint enforces it); the API returns error codes the web translates; a test keeps both languages in sync.
- **Secure sessions.** Google ID token verified on the server, 15-minute access token kept in memory, hashed and rotating refresh tokens with reuse detection. See [docs/decisions/0002-authentication.md](docs/decisions/0002-authentication.md).

## Project structure

```
apps/
  web/      React app
  api/      Express + Prisma API
packages/
  ui/       design system + Storybook
  shared/   Zod schemas, types, error codes
docs/       design guide, decisions, setup guides
```

## License

[MIT](LICENSE) © 2026 Daniel Rosa Herazo
