# 0010 · A disposable `dev` environment beside production

- **Status:** accepted
- **Date:** 2026-11-13
- **Extends:** ADR 0002 (one more allowed origin, on `dev` only)

## Context

Vercel's preview deployments (one URL per branch) couldn't get past sign-in. Google doesn't accept wildcard JavaScript origins, the API only accepts requests whose `Origin` equals `WEB_ORIGIN` on every `/api/auth` endpoint (email codes included), and the `/api/*` rewrite in `apps/web/vercel.json` is static, so every preview talked to the production API and database. Trying a change in the real app before merging, for example the shopping list on two phones, wasn't possible. Everything has to stay on free plans, and there is one developer.

## Decision

### One extra environment

- There is one environment besides production: **`dev`**, at `dev.hogar.therandomcollection.co`. Production stays at `hogar.therandomcollection.co`. The old `hogar-virid-nine.vercel.app` redirects (308) to the production domain.
- `dev` serves a **disposable `dev` git branch**. To try a branch, force-push it (`git push origin <branch>:dev --force`). `dev` is never merged; PRs still go to `main`.
- On every push to `dev`, both the web (Vercel, the same project, with the domain assigned to the branch) and the API (`hogar-api-dev`, a second service in `render.yaml` with `autoDeployTrigger: commit`) deploy, without waiting for CI. A prototype that fails lint can still be tried, and the branch's own PR runs CI.

### Routing

- The `/api/*` rewrites in `vercel.json` are **chosen by host**: only `hogar.therandomcollection.co` reaches the production API, and every other host (`dev` and every preview) reaches the `dev` API. A preview can never write to real data.

### Previews

- On `dev` only, the API also accepts the origins of the project's previews through an optional **`WEB_PREVIEW_ORIGIN`** with a single `*`, for example `https://hogar-*-<scope>.vercel.app`. The `*` matches only `[a-z0-9-]+`, the match is anchored at both ends and is `https` only, and config validation rejects a malformed pattern, including one with no fixed text on either side of the `*` inside its label (so `https://*.vercel.app` can't trust every site on Vercel). Without the variable (production, local) only `WEB_ORIGIN` is accepted, exactly as before. It is a wildcard rather than a regex because a regex in an env file is easy to leave unanchored or unescaped, and that mistake is invisible in review.
- Previews sign in with an email code; Google works on `dev`'s fixed URL and in production. The `dev` API runs the `dev` branch, so previews suit web-only changes; changes that touch the API are tried by pushing them to `dev`.

### Data and services

- The `dev` database is a **separate Neon project** (`hogar-dev`, Frankfurt), not a database or branch inside production's project. It has its own host and credentials, so nothing configured for `dev` can reach production. It starts empty, with migrations only and no production data.
- When migrations diverge between branches, or for a fresh start, a manual **GitHub Actions workflow** ("Reset dev database", `workflow_dispatch`) checks out `dev` and runs `prisma migrate reset --force` against the `DEV_DATABASE_URL` secret.
- Email goes through Resend on the same domain, with a **separate `dev` API key** and a sender that says `dev`. Google uses the same OAuth client with `dev`'s origin added. Secrets such as `JWT_ACCESS_SECRET` and `EMAIL_CODE_SECRET` are generated per service, so tokens never work across environments.
- Vercel's default **Standard Protection** stays on, so only the owner's Vercel account can open `dev` and previews.

## Considered options

- **Working previews per branch, each with its own API and database:** Render's preview environments are paid, and a per-preview database needs automation that one developer doesn't need.
- **A `staging` environment as well:** it only pays off when a team validates releases; production already deploys only after CI passes.
- **Routing Middleware reading the API URL from an env var:** more flexible, but an edge function to test and bill, where two static rewrite rules suffice.
- **The web calling the API on Render directly:** breaks the single origin (ADR 0002 consequences, `docs/deploy.md`), needing CORS and `SameSite=None` cookies.
- **The `dev` database inside production's Neon project:** the reset is one click, and a pasted wrong URL would wipe production.
- **Resetting the database on every `dev` deploy:** always clean, but every push, even a copy fix mid-test, would sign both phones out and delete the test household.

## Consequences

- `dev` is a single slot: two branches with API changes can't be tried at the same time. Previews ease this for web-only changes.
- After pushing a branch whose migrations differ from what `dev` ran before, the database must be reset by hand, or the API may fail on schema mismatches.
- Free-plan quotas are shared: both Render services draw from the workspace's 750 hours a month (both sleep when idle), and `dev` and production share Resend's 100 emails a day.
- The pattern checks a suffix, not ownership of the Vercel scope: someone could create a scope ending in ours (`evil-<scope>`) and their preview `https://hogar-x-evil-<scope>.vercel.app` would match. This is accepted because it only reaches `dev`, which holds no real data, and because `vercel.app` is on the Public Suffix List, so such a page is cross-site and the browser never sends it the `SameSite=Lax` refresh cookie.
- If the Socket.io prototype shows that WebSockets don't get through Vercel's rewrite, each environment gets an `api.` subdomain (`api.hogar…`, `api.dev.hogar…`, free on Render) and the socket's origin check reuses `WEB_ORIGIN` and `WEB_PREVIEW_ORIGIN`. Until then the browser keeps a single origin.
- Letting other people try `dev` on their own devices would require revisiting Vercel's protection, which on the free plan only admits the owner.
