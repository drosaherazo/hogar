# 0002 · Authentication: Google ID token, in-memory access token, rotating refresh token

- **Status:** accepted
- **Date:** 2026-10-26

## Context

People sign in with their Google account. The API must give the web app its own token with the user's basic info, and sessions should survive reloads without exposing long-lived secrets to JavaScript. CLAUDE.md requires a short-lived JWT, a refresh token in an httpOnly cookie with rotation, and hashed secrets.

## Decision

### Sign-in

- The web renders Google's official button with **Google Identity Services** (popup mode). Google returns a signed **ID token**.
- The web posts it to `POST /api/auth/google`. The API verifies it with `google-auth-library` (signature, expiry, `audience` = our Client ID) and requires `email_verified`.
- The user is **upserted by Google `sub`**: name, email and photo are refreshed on each login; the locale is only guessed on sign-up (Google `locale` claim, else `Accept-Language`, else `en`) and is the person's choice afterwards.
- We chose this over the server-side authorization-code flow: no redirects, no client secret, and we don't need Google API scopes. If we ever need them (calendar, etc.), we can add the code flow.

### Tokens

- **Access token:** HS256 JWT signed with `jose`, **15 minutes**, claims `sub`, `email`, `name`, `picture`, `locale`, `iss=hogar-api`, `aud=hogar-web`. The web keeps it **in memory only** (never `localStorage`), so an XSS can't steal a long-lived credential from storage.
- **Refresh token:** 32 random bytes, sent as cookie `hogar_refresh` with `HttpOnly; SameSite=Lax; Path=/api/auth; Secure` (in production), **stored only as a SHA-256 hash**, valid 30 days.
- **Rotation:** every `POST /api/auth/refresh` revokes the presented token and issues a new one in the same **family**.
- **Reuse detection:** presenting an already-rotated token revokes the whole family (`auth.session.reused`), ending the session on every device that shared it. A **10-second grace window** treats reuse right after rotation as a benign race (two tabs refreshing at once) and just answers `auth.session.missing`.
- The web client **shares a single in-flight refresh** between callers, restores the session on startup with a silent refresh, and on any 401 refreshes once and retries.
- `POST /api/auth/logout` revokes the family and clears the cookie.

### CSRF and abuse

- Cookie endpoints require `Origin` to equal `WEB_ORIGIN` (`request.forbidden_origin` otherwise); together with `SameSite=Lax` this blocks cross-site requests.
- In development Vite proxies `/api`, so the cookie is first-party and there's no CORS.
- `express-rate-limit` on `/api/auth` (100 requests / 15 min / IP).

### Errors

- The API never returns sentences: `{ "error": { "code": "auth.session.expired" } }`. Codes live in `packages/shared`; the web translates them (`errors` namespace), and a test ensures every code has an `en` and `es` message.

## Consequences

- Each page load costs one refresh request and one token rotation (cheap; keeps the access token out of storage).
- Deploying web and API on different sites (Vercel + Render) will need `SameSite=None; Secure` on the cookie, or a same-site setup (custom domain or a Vercel rewrite to the API). To decide at deploy time.
- Google sign-in can't be automated in E2E: Cypress stubs the GIS script and the API; the API itself is covered by Supertest against a real Postgres with a fake verifier.
