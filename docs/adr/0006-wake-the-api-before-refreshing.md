# 0006 · Wake the API with a health check before restoring the session

- **Status:** accepted
- **Date:** 2026-11-12

## Context

The API runs on Render's free plan, which sleeps after ~15 minutes without traffic; the first request after that takes 30–50 seconds while the instance boots. On start, the web restores the session with `POST /api/auth/refresh`.

The refresh token rotates on every use, and a revoked token that comes back after the 10-second grace window is treated as theft: the whole session family is revoked (ADR 0002). During a cold start the Vercel rewrite in front of Render may give up and answer with a 5xx while Render still delivers the request after booting. If that request was a refresh, the API rotates the token, the response never reaches the browser, and the cookie keeps the old token. Retrying would look like reuse and sign the person out of every device.

## Decision

The web first polls `GET /api/health` until it answers `2xx` (each attempt times out after 15 s, failed attempts are retried after 2 s) and only then sends a single refresh. The health check has no side effects, touches no database and sits outside the `/api/auth` rate limiter, so it can be retried freely. A refresh that fails with `0`, `429` or `5xx` sends the loop back to polling. The person sees the wake-up screen meanwhile, and after 90 seconds of waiting for the server it offers to try again.

## Considered options

- **Retry the refresh itself on network errors and 5xx:** simplest, but risks the token-reuse revocation above.
- **Refresh first, poll only after a failure:** saves a round trip on a warm server, but the first refresh is exactly the one a cold start is most likely to cut.
- **Keep the API warm with a scheduled ping:** complementary and free, but an infrastructure decision; the app still needs an honest wait for the times it isn't enough. Recorded as future work.

## Consequences

- A warm start costs one extra short round trip, well under the 1-second threshold before the wake-up screen appears, so nobody notices it.
- Any new code that calls the refresh endpoint at startup must go through this wait, never call it blindly.
