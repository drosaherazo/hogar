# Research: Wake-up loading screen

All Technical Context unknowns are resolved below. Each entry records the decision, why, and what
was rejected.

## R1. How the app waits for a sleeping server without breaking the session

**Decision**: Wake the server with `GET /api/health` first, polling until it answers `2xx`, and only
then send a single `POST /api/auth/refresh`. Each health attempt has its own 15-second timeout and
failed attempts are retried after 2 seconds, until the 90-second limit.

**Rationale**:

- The API rotates the refresh token on every use and treats a revoked token that comes back after
  the 10-second grace window (`ROTATION_GRACE_MS` in `apps/api/src/auth/authService.ts`) as theft:
  it revokes the whole session family (`auth.session.reused`).
- While Render is asleep, the request is held by Render's edge until the instance boots, and the
  Vercel rewrite in front of it may give up earlier and answer with a 5xx. If that request was a
  refresh, Render can still deliver it to the API after boot. The API rotates the token, the
  response never reaches the browser, and the cookie keeps the old token. The next retry would then
  look like reuse and sign the person out of every device. That is exactly the "sent to the login
  page because the server was asleep" bug the spec forbids (FR-007).
- `/api/health` is a `GET` with no side effects, no database access, and sits outside the
  `/api/auth` rate limiter, so it can be retried freely.
- On a warm server this adds one short round trip, far below the 1-second reveal threshold, so
  nobody sees the difference.

**Alternatives considered**:

- _Retry the refresh itself on network/5xx_: simplest, but risks token-reuse revocation as described
  above.
- _Refresh first, fall back to health polling only after a failure_: saves one round trip when warm,
  but the very first refresh is the one most likely to be cut by the proxy during a cold start, so
  it keeps the risk.
- _Keep the server warm with a scheduled ping_: complementary and free, but it is an infrastructure
  decision the spec leaves out of scope. The app still needs an honest waiting screen for the times
  the ping isn't enough.

## R2. Which failures mean "still waking" and which mean "not signed in"

**Decision**:

- Health: anything other than a `2xx` (network error, timeout, any status) means the server is still
  waking, so retry.
- Refresh, once health is OK: status `0` (network/abort), `429` or `>= 500` → go back to waking.
  Any other `4xx` → anonymous. `2xx` → authenticated.

**Rationale**: once health has answered, the API is running, so a `4xx` from refresh is a real
answer (`auth.session.missing`, `expired`, `reused`). Network errors and 5xx after a healthy check are
rare (Neon cold start, a deploy in progress) and are safe to retry because the server is up. `429`
is retryable because it says nothing about the session. `ApiRequestError.status` already carries
this information (0 for network), so no new error type is needed.

**Alternatives considered**: telling the cases apart by error code alone was rejected, because
proxy pages aren't JSON and arrive as `server.unexpected` / `request.invalid`, so the status is the
reliable signal.

## R3. Timeouts and cancellation

**Decision**: add an optional `signal?: AbortSignal` to the client's `RequestOptions` and a
`health(signal)` method. `waitForServer` creates one `AbortController` per attempt, aborts it after
15 seconds with `setTimeout`, and links it to an outer signal that the auth provider aborts on
unmount, on the 90-second limit and when the device goes offline. An aborted fetch already becomes
`ApiRequestError("network", 0)` in `request()`.

**Rationale**: works in every browser the app targets without relying on `AbortSignal.any` or
`AbortSignal.timeout` (newer, uneven support), and stays easy to drive with fake timers in Vitest.

**Alternatives considered**: `AbortSignal.any([outer, AbortSignal.timeout(15000)])`, which is cleaner
but ties support to Safari 17.4+ and is awkward with fake timers.

## R4. Timings

**Decision** (all in one constants module, `apps/web/src/startup/wakeUp.ts`):

| Constant               | Value             | Why                                                                                                        |
| ---------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `REVEAL_AFTER_MS`      | 1 000             | FR-002: answers within 1 s never show the scene.                                                           |
| `MIN_VISIBLE_MS`       | 500               | FR-002: once shown, the scene stays at least half a second.                                                |
| Stage starts           | 0, 15 000, 35 000 | "Knocking" from reveal, "lights" a third into a typical 30–50 s boot, "almost" after.                      |
| `TIP_INTERVAL_MS`      | 7 000             | ≥ 6 s per tip (FR-005), with a margin for slower readers and longer Spanish copy.                          |
| Tip count              | 10                | 10 × 7 s = 70 s of distinct tips, which covers SC-004 (60 s, ≥ 8 tips, no repeats).                        |
| `GIVE_UP_AFTER_MS`     | 90 000            | FR-008.                                                                                                    |
| Health attempt timeout | 15 000            | Long enough not to cut a request Render is about to serve, short enough to recover from a dead connection. |
| Retry delay            | 2 000             | A flat delay; the 90 s cap already bounds the number of attempts (~10–40).                                 |

Elapsed time is measured from the wait's `startedAt` with `Date.now()`, never by counting ticks, so
a tab that was in the background shows the right stage and tip when it comes back (spec edge case).

**Alternatives considered**: exponential backoff, which isn't needed for a single cheap `GET`
bounded by 90 seconds.

## R5. Where the logic and the UI live

**Decision**:

- `packages/ui`: a new presentational `WakeUpScreen` component (illustration, live status,
  description, tip, action slot), with every string coming in through props as the constitution
  requires.
- `apps/web/src/startup/`: pure, unit-tested functions (`stageAt`, `tipIndexAt`, `isWakingError`,
  `settleDelay`) and `waitForServer`.
- `AuthProvider` owns the wait (it already owns the startup refresh), so its `loading` state gains a
  `phase` and an `attempt`, and the context gains `retry()`.
- `apps/web/src/layout/WakeUpLoading.tsx` replaces `FullPageLoading`: it reads the auth state,
  derives the stage and tip from elapsed time, translates, and renders `WakeUpScreen`.

**Rationale**: it follows the existing split (domain-free logic in web, copy-free components in ui)
and makes the scene reviewable in Storybook on its own, in both themes and languages, which is part
of the portfolio value.

**Alternatives considered**:

- _Everything inside `apps/web/src/layout`_: fewer files, but it would skip the ui component
  contract (tests with axe, story, bilingual docs) for the most visible new piece of UI.
- _A separate `ServerStatusProvider`_: a second context that has to coordinate with auth for no
  benefit, since only the startup refresh waits for the server.

## R6. The illustration and its motion

**Decision**: an inline SVG house drawn in the existing mark's style, coloured only with semantic
tokens (`--color-brand-surface`/`--color-accent` for the brand shape, `--color-brand-tint` for lit
windows, `--color-surface` and `--color-border` for neutrals; the exact pairing is picked during
implementation). Windows light up one after another in a slow, gentle loop and a wisp of smoke rises
from the chimney; nothing bounces or blinks. A `mood` prop switches between `waking` (animated) and
`resting` (still, used for the slow and offline states).

A new motion token, `--duration-ambient` (2 400 ms), sits next to the existing durations in
`primitives.css` for slow ambient loops, and `docs/design.md` plus Foundations › Motion and tone
document it. Under `prefers-reduced-motion`, `base.css` already collapses animations to a single
near-instant iteration; keyframes use `animation-fill-mode: both` and end in the "all lights on"
frame, so the reduced-motion scene is a complete, still picture.

**Rationale**: the design guide only allows token durations and the longest one (320 ms) is meant
for dialogs; a calm loop needs seconds. A named token keeps the "durations only from tokens" rule
instead of hiding `calc(var(--duration-slow) * 7.5)` in a module.

**Alternatives considered**: a Lottie or GIF animation, which would mean a new dependency or raster
asset and couldn't follow the theme tokens; and multiplying `--duration-slow` with `calc`, which
satisfies the rule only on paper.

## R7. Accessibility of a screen that changes on its own

**Decision**: the status heading (`h1`) sits inside a `role="status"` region, so stage changes and
the slow/offline titles are announced politely, once each. The description sits outside the live
region so it isn't re-read. The tip lives in a plain paragraph outside any live region, so rotation
is silent. The page is `aria-busy` while waiting. Focus is not moved when "Try again" appears; it is
the only focusable element, so one Tab reaches it.

**Rationale**: FR-011, and WAI-ARIA guidance that live regions announce only changed nodes. Moving
focus on a timer-driven change would disorient screen-reader users.

## R8. Offline detection

**Decision**: read `navigator.onLine` when the wait starts and listen to `offline`/`online` on
`window`. Going offline aborts the current attempt and shows the offline state (still illustration).
Coming back online starts a new attempt immediately with the scene already revealed.

**Rationale**: `navigator.onLine === false` is reliable (it can only be wrong in the "online"
direction, and that case falls through to normal waking), and it needs no dependency.

## R9. Testing approach

**Decision**:

- Vitest unit tests for the pure functions and for `waitForServer` (fake timers and a fake fetch:
  5xx then 200, timeouts, abort).
- `client.test.ts` covers `health()` and the `signal` option.
- An `AuthProvider` test drives the whole startup with fake timers: a slow wake, no login redirect
  on 5xx, the 90 s limit, `retry()`, offline/online.
- `WakeUpLoading` test for reveal and min-visible timing, stage and tip rotation, and live-region
  behaviour.
- `WakeUpScreen` component test with axe in every state, plus stories for waking, slow and offline in
  both themes.
- Cypress: `cypress/support/e2e.ts` stubs `GET /api/health` with `200` by default so existing flows
  keep working. A new `wake-up.cy.ts` uses `cy.clock()`/`cy.tick()` with health stubs that answer
  `503` several times and then `200`, covering a deep link that survives a long wake and the slow
  state with "Try again".

**Rationale**: matches Principle IV and keeps every timing assertion deterministic.

## R10. Open facts not needed for the design

- The exact time after which Vercel's rewrite gives up on a sleeping Render instance isn't
  documented clearly. The design doesn't depend on it: health polling works the same whether the
  proxy holds the request for 50 s or cuts it at 10 s.
