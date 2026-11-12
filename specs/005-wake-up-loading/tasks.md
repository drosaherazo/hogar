# Tasks: Wake-up loading screen

**Input**: Design documents from `specs/005-wake-up-loading/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wake-up-screen.md, contracts/startup-api.md, contracts/i18n-keys.md, quickstart.md

**Tests**: Required. Constitution principle IV calls for:

- Unit tests for all logic (timing helpers, health polling, the startup state machine), with fake timers.
- A test with axe plus a story for every ui component.
- Cypress for the main flow (a signed-in deep link surviving a long wake).

There are no endpoint changes, so no new Supertest tests. Within each story, test tasks come first and must fail before implementation.

**Organization**: Tasks are grouped by user story so each one can be implemented, tested and demoed on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US3 from spec.md
- Paths are relative to the repository root

## Path Conventions

- UI: `packages/ui/src/components/WakeUpScreen/` (tsx, module.css, test with axe, stories, bilingual mdx), following `packages/ui/src/components/EmptyState/`
- Web: `apps/web/src/`; startup logic in the new `apps/web/src/startup/`; E2E in `apps/web/cypress/e2e/`
- Timing constants (from research R4, use these exact values): `REVEAL_AFTER_MS = 1000`, `MIN_VISIBLE_MS = 500`, stages `knocking` at 0, `lights` at 15000, `almost` at 35000, `TIP_INTERVAL_MS = 7000`, 10 tips, `GIVE_UP_AFTER_MS = 90000`, health attempt timeout 15000, retry delay 2000
- Styles: semantic tokens only (`--color-*`, `--space-*`, `--duration-*`, `--easing-*`); no hex, raw `px` or primitives in `*.module.css`

---

## Phase 1: Setup

**Purpose**: A clean baseline.

- [x] T001 Confirm the baseline on `feat/wake-up-loading`: `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm --filter @hogar/web test` and `pnpm --filter @hogar/ui test` green before any change (API tests aren't affected; run them only if Postgres is up)

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The health request, the pure timing helpers, the polling loop, the motion token, the copy and the E2E default stub. Every story builds on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Write failing tests in `apps/web/src/api/client.test.ts`: `health()` sends `GET /api/health` without an `Authorization` header and resolves on `200`; rejects with `ApiRequestError` keeping the status on `503` and with `("network", 0)` on a fetch rejection; a `signal` passed to `health(signal)` reaches `fetchImpl`, and aborting it rejects with `ApiRequestError("network", 0)`
- [x] T003 Implement in `apps/web/src/api/client.ts`: add `signal?: AbortSignal` to `RequestOptions` and pass it to `fetchImpl`; add `health(signal?: AbortSignal): Promise<void>` calling `this.request("/health", { authenticated: false, signal })` (doc comment: "Resolves when the API answers 2xx; rejects with ApiRequestError otherwise.")
- [x] T004 [P] Write failing tests in `apps/web/src/startup/wakeUp.test.ts` for the rules in `specs/005-wake-up-loading/data-model.md`: `stageAt` returns `knocking` for 0–14999, `lights` for 15000–34999, `almost` from 35000 on (and for huge values); `tipIndexAt(elapsedMs, 10)` is 0 before 1000 + 7000, steps every 7000 ms after reveal, yields 10 distinct indexes before the first repeat and wraps with `mod count`; `isRevealed` is "`attempt > 0 || elapsedMs >= REVEAL_AFTER_MS`"; `settleDelay` is 0 when never revealed (elapsed < 1000, attempt 0), 500 at elapsed 1000, 200 at elapsed 1300, 0 at elapsed ≥ 1500, and for `attempt > 0` keeps the scene at least 500 ms from the start of that attempt; `isWakingError` is true for `ApiRequestError` with status `0`, `429` or `>= 500` and for non-`ApiRequestError` values, false for `400`, `401`, `403`, `404`; `TIP_IDS` has exactly 10 unique ids
- [x] T005 Implement `apps/web/src/startup/wakeUp.ts`: export `REVEAL_AFTER_MS`, `MIN_VISIBLE_MS`, `TIP_INTERVAL_MS`, `GIVE_UP_AFTER_MS`, `WAKE_STAGES` (`[{ id: "knocking", startMs: 0 }, { id: "lights", startMs: 15000 }, { id: "almost", startMs: 35000 }] as const`), `TIP_IDS` (`["inviteLink", "weights", "exactCents", "customSplit", "settleUp", "fixMistakes", "guests", "movedOut", "darkTheme", "language"] as const`), `stageAt`, `tipIndexAt`, `isRevealed`, `settleDelay`, `isWakingError`, with types `WakeStageId` and `TipId`
- [x] T006 [P] Write failing tests in `apps/web/src/startup/waitForServer.test.ts` with Vitest fake timers and a fake `client.health`: resolves immediately when health resolves; after three `503` rejections it waits 2000 ms between attempts and resolves on the fourth; an attempt that hangs is aborted after 15000 ms (the signal passed to `health` becomes aborted) and a new attempt starts after the 2000 ms delay; aborting the outer `signal` while waiting or mid-attempt rejects with an `AbortError` (`DOMException` name `"AbortError"`) and stops all further `health` calls
- [x] T007 Implement `apps/web/src/startup/waitForServer.ts` per `specs/005-wake-up-loading/contracts/startup-api.md`: `waitForServer({ client, signal, attemptTimeoutMs = 15000, retryDelayMs = 2000 })`; one `AbortController` per attempt aborted by `setTimeout` and by the outer signal (no `AbortSignal.any`/`AbortSignal.timeout`, see research R3); any health rejection means "still waking"; clean up timers and listeners on every exit path
- [x] T008 [P] Add `--duration-ambient: 2400ms;` next to `--duration-fast|base|slow` in `packages/ui/src/tokens/primitives.css` and update `packages/ui/src/tokens/tokens.test.ts` if it enumerates the duration tokens
- [x] T009 [P] Add every `wakeUp.*` key from `specs/005-wake-up-loading/contracts/i18n-keys.md` to `apps/web/src/i18n/locales/en/common.json` and `apps/web/src/i18n/locales/es/common.json`, with the exact en/es copy from that table (leave the old `loading` key for now; it is removed in T018); confirm `apps/web/src/i18n/i18n.test.ts` parity passes
- [x] T010 [P] In `apps/web/cypress/support/e2e.ts`, add a default `cy.intercept("GET", "/api/health", { statusCode: 200, body: { status: "ok" } }).as("health")` inside the existing `beforeEach`, with a comment that the startup polls health before restoring the session

**Checkpoint**: Helpers and polling are tested; stories can start.

---

## Phase 3: User Story 1 - A returning member knows what is happening and gets in (Priority: P1) 🎯 MVP

**Goal**: The startup waits safely for a sleeping server (health first, then one refresh) and shows a screen that explains the wait with status stages, then lands the person on their requested page.

**Independent Test**: With health answering `503` for 45 s and then `200`, open a deep link as a signed-in member. The screen explains the wait within a second of appearing, the status moves through the stages, and the member lands on the deep link, not on `/login`.

### Tests for User Story 1

- [x] T011 [P] [US1] Write failing tests in `packages/ui/src/components/WakeUpScreen/WakeUpScreen.test.tsx`: `status` renders as an `h1` inside an element with `role="status"`; `description` renders outside that element; `<main>` has `aria-busy="true"` by default (`mood="waking"`) and not with `mood="resting"`; `action` is rendered and focusable with Tab; the illustration is `aria-hidden="true"`; no axe violations for a waking configuration (status + description)
- [x] T012 [P] [US1] Write failing tests in `apps/web/src/auth/AuthProvider.test.tsx` (fake timers, a fake `ApiClient` with `health`, `refresh` and `onSessionExpired`, rendered inside `QueryClientProvider` and the i18n provider used by other web tests): the initial state is `{ status: "loading", phase: "waking", attempt: 0, startedAt: <now> }`; health `200` then refresh `200` → `authenticated` with the user, and `health` is called before `refresh`; health rejects three times with `503` then resolves → `refresh` is called exactly once, after the healthy check, and the state becomes `authenticated`; health OK then refresh `401` (`auth.session.missing`) → `anonymous`; health OK then refresh `503` → back to polling health (state stays `loading`/`waking`, never `anonymous`), then health OK and refresh `200` → `authenticated`, with exactly one refresh per healthy check; a refresh that resolves at elapsed 1200 ms only leaves `loading` at 1500 ms (`settleDelay`), and one that resolves at 300 ms leaves immediately; unmounting aborts the wait (no further `health` calls)
- [x] T013 [P] [US1] Write failing tests in `apps/web/src/layout/WakeUpLoading.test.tsx` (fake timers; render with a mocked `useAuth` returning a `loading` state): before 1000 ms the page shows no status text and no illustration (only the empty `<main aria-busy="true">`); at 1000 ms it shows "Knocking on your home's door…" as the h1 and the `wakeUp.description` copy; at 15000 ms the status is "Turning on the lights…"; at 35000 ms and at 80000 ms "Almost there, putting the kettle on…"; with `attempt: 1` the scene shows immediately at 0 ms; the stage follows `Date.now() - startedAt` (jump the clock by 20000 ms in one step and expect "Turning on the lights…"); in Spanish the status reads "Llamando a la puerta de tu hogar…"

### Implementation for User Story 1

- [x] T014 [US1] Create `packages/ui/src/components/WakeUpScreen/WakeUpScreen.tsx` and `WakeUpScreen.module.css` per `specs/005-wake-up-loading/contracts/wake-up-screen.md`, with props `status`, `description`, `tipLabel`, `tip`, `action`, `mood = "waking"`, `className` (tip props may render plainly for now; US2 styles and animates them): `<main>` centred with `min-block-size: 100dvh` and `--space-*` gaps, `aria-busy` only when waking; a decorative inline SVG house in the style of `apps/web/public/hogar-mark-light.svg`, coloured only with semantic tokens (brand shape `--color-brand-surface` or `--color-accent`, windows `--color-brand-tint`, neutrals `--color-surface`/`--color-border`), still for now; status `h1` inside `<div role="status">`; description `<p>` outside it; action slot; no fixed widths on text so it fits 320 px and 200 % zoom; doc comments on every prop
- [x] T015 [US1] Export `WakeUpScreen` and `WakeUpScreenProps` from `packages/ui/src/index.ts`, alphabetically between `TextField` and the end, matching the existing export style
- [x] T016 [P] [US1] Create `packages/ui/src/components/WakeUpScreen/WakeUpScreen.stories.tsx` with a `Waking` story (English status and description as args), following the Theme and Locale toolbar conventions of `packages/ui/src/components/EmptyState/EmptyState.stories.tsx`
- [x] T017 [US1] Rework `apps/web/src/auth/AuthProvider.tsx` per `specs/005-wake-up-loading/data-model.md`: extend `AuthState`'s loading member to `{ status: "loading"; user: null; phase: "waking" | "slow" | "offline"; startedAt: number; attempt: number }` and export `WaitPhase`; replace the bare `client.refresh()` in the startup effect with an async loop: `await waitForServer({ client, signal })`, then one `client.refresh()`; on success `signIn(user)`, on an error where `isWakingError(error)` loop back to `waitForServer`, on any other error go `anonymous`; before leaving `loading`, wait `settleDelay(Date.now() - startedAt, attempt)` ms; abort everything on unmount through an `AbortController`; keep `onSessionExpired`, `loginWithGoogle` and `logout` behaviour unchanged; keep a doc comment explaining why health comes before refresh (token rotation and reuse revocation, research R1)
- [x] T018 [US1] Create `apps/web/src/layout/WakeUpLoading.tsx` (+ `WakeUpLoading.module.css` for the pre-reveal page, `min-block-size: 100dvh` and `background: var(--color-bg)`): reads `useAuth().state`; re-renders once per second from a `setInterval` cleared on unmount; before `isRevealed(...)` renders an empty `<main aria-busy="true">`; afterwards renders `WakeUpScreen` with `status={t(`wakeUp.stage.${stageAt(elapsed).id}`)}` and `description={t("wakeUp.description")}`. Then delete `apps/web/src/layout/FullPageLoading.tsx` and `FullPageLoading.module.css`, and remove the `loading` key from both `common.json` files (done differently: the key stays, because in-app spinners still use it and FR-014 keeps them unchanged)
- [x] T019 [US1] Replace `FullPageLoading` with `WakeUpLoading` in `apps/web/src/auth/guards.tsx` (both guards) and update `apps/web/src/auth/guards.test.tsx` fixtures to the new loading state shape (`phase: "waking"`, `startedAt`, `attempt: 0`), plus any other test that builds an `AuthState` or an `AuthContextValue` (search `status: "loading"` under `apps/web/src`)
- [x] T020 [US1] Create `apps/web/cypress/e2e/wake-up.cy.ts` with "keeps a signed-in member on their page through a long wake-up": `cy.clock()`; stub `GET /api/health` to answer `503` for the first 5 requests and `200` afterwards (a counter in a `req.reply` handler); stub `POST /api/auth/refresh` with `session()` from `../support/e2e` and `GET /api/household` as needed; visit `/expenses`; `cy.tick(1000)` and expect the h1 "Knocking on your home's door…"; tick through the retries (2000 ms per failed attempt) and past 15000 ms to see "Turning on the lights…"; assert `@refresh` fires exactly once and only after health turned `200`; assert the final pathname is `/expenses` and never `/login`

**Checkpoint**: The MVP. A cold start explains itself and no longer signs people out. Ship-ready on its own.

---

## Phase 4: User Story 2 - The wait is pleasant, not empty (Priority: P2)

**Goal**: An animated house and a rotating set of 10 tips make the wait feel like a moment with the app, silently for screen readers and still under reduced motion.

**Independent Test**: Keep the server asleep for 60 s. Tips change every ~7 s with no repeats, the house is animated, and with reduced motion the house is still and tips swap without fading.

### Tests for User Story 2

- [x] T021 [P] [US2] Extend `packages/ui/src/components/WakeUpScreen/WakeUpScreen.test.tsx`: `tipLabel` and `tip` render outside the `role="status"` element and outside any `aria-live` region; changing `tip` replaces the tip element (new node, so the fade replays); with `mood="waking"` the illustration has the animated class and with `mood="resting"` it doesn't; no axe violations with a tip
- [x] T022 [P] [US2] Extend `apps/web/src/layout/WakeUpLoading.test.tsx`: at 1000 ms it shows the "Quick tip" label and the first tip ("Invite the people you live with by sharing a link. No emails needed."); the tip changes at 8000 ms; ten distinct tips appear over 1000–71000 ms with no repeat; jumping the clock by 30000 ms in one step shows the tip for that elapsed time; the `role="status"` element never contains tip text

### Implementation for User Story 2

- [x] T023 [US2] In `packages/ui/src/components/WakeUpScreen/WakeUpScreen.tsx` and `.module.css`: render `tipLabel` + `tip` as a small sunken block (`--color-surface-sunken`, `--radius-lg`), keyed by `tip` so it remounts, with a fade-in using `--duration-base` and `--easing-gentle`; animate the house only when `mood === "waking"`: windows light up one after another and a wisp of smoke rises, using `opacity`/`transform` keyframes with `--duration-ambient` (multiples or staggered `animation-delay` built from the token), `--easing-gentle`, `animation-fill-mode: both`, final keyframe = all windows lit, nothing bouncing or blinking (research R6); rely on `packages/ui/src/tokens/base.css` for reduced motion, no JS media queries
- [x] T024 [US2] In `apps/web/src/layout/WakeUpLoading.tsx`, pass `tipLabel={t("wakeUp.tipLabel")}` and `tip={t(`wakeUp.tips.${TIP_IDS[tipIndexAt(elapsed, TIP_IDS.length)]}`)}` to `WakeUpScreen`
- [x] T025 [US2] Check every tip in `apps/web/src/i18n/locales/{en,es}/common.json` against the running app: the household settings page really sets member weights, the expense form really changes a single expense's split, the guest role exists with read-only access, removed members keep their history, and theme and language are in the account menu (`apps/web/src/layout/AppHeader.tsx`); adjust en and es wording to match the UI's own labels, and update `specs/005-wake-up-loading/contracts/i18n-keys.md` if anything changes
- [x] T026 [P] [US2] In `packages/ui/src/components/WakeUpScreen/WakeUpScreen.stories.tsx`, add the tip to `Waking` and add `WakingSpanish` with the Spanish status, description, label and the longest Spanish tip, to prove the layout holds with longer copy
- [x] T027 [US2] Extend `apps/web/cypress/e2e/wake-up.cy.ts`: after the first tip is visible, `cy.tick(7000)` and expect a different tip

**Checkpoint**: US1 + US2 deliver the full "entertaining and informative" screen.

---

## Phase 5: User Story 3 - A wait that goes wrong ends with a way forward (Priority: P3)

**Goal**: After 90 s the screen offers "Try again"; offline devices are told so and resume on their own.

**Independent Test**: Keep health failing for over 90 s: the slow message and "Try again" appear, and pressing it restarts the wait. Start offline: the offline message shows and the wait resumes when the connection returns.

### Tests for User Story 3

- [x] T028 [P] [US3] Extend `apps/web/src/auth/AuthProvider.test.tsx`: with health always failing, at 90000 ms the state becomes `phase: "slow"` and no more `health` calls happen; `retry()` from the context sets `phase: "waking"`, `attempt: 1`, a fresh `startedAt`, and polling resumes; `retry()` is a no-op outside `loading`/`slow`; with `navigator.onLine === false` at mount the state starts as `phase: "offline"` with no `health` call; an `offline` event mid-wait aborts the current attempt and sets `phase: "offline"`; a later `online` event sets `phase: "waking"`, increments `attempt` and polls again; going offline also clears the 90 s timer (it restarts with the new attempt)
- [x] T029 [P] [US3] Extend `apps/web/src/layout/WakeUpLoading.test.tsx`: `phase: "slow"` shows the h1 "This is taking longer than usual", the slow description and a "Try again" button that calls `retry` from `useAuth`, with `WakeUpScreen` in `mood="resting"` (no `aria-busy`); `phase: "offline"` shows "You seem to be offline" and "We'll carry on as soon as you're back online.", no button, `mood="resting"`; neither state shows a tip
- [x] T030 [P] [US3] Extend `packages/ui/src/components/WakeUpScreen/WakeUpScreen.test.tsx` with no axe violations for a resting configuration with a `Button` action (slow) and one without an action (offline)

### Implementation for User Story 3

- [x] T031 [US3] In `apps/web/src/auth/AuthProvider.tsx`: start a `GIVE_UP_AFTER_MS` (90000) timer per attempt that aborts the wait and sets `phase: "slow"`; add `retry()` to `AuthContextValue` (no-op unless `loading` with `phase: "slow"`) that starts a new attempt with `attempt + 1` and a fresh `startedAt`; check `navigator.onLine` at start and listen to `window` `offline`/`online` (removed on unmount): offline aborts the attempt and clears the timer, setting `phase: "offline"`; online starts a new attempt with `attempt + 1`
- [x] T032 [US3] In `apps/web/src/layout/WakeUpLoading.tsx`: for `phase: "slow"` render `WakeUpScreen` with `mood="resting"`, `status={t("wakeUp.slow.title")}`, `description={t("wakeUp.slow.description")}` and `action={<Button onClick={retry}>{t("wakeUp.retry")}</Button>}` (primary variant, the only action on the screen); for `phase: "offline"` render `mood="resting"` with the offline title and description and no action; no tip in either state
- [x] T033 [P] [US3] Add `Slow` (with a `Button` action) and `Offline` stories to `packages/ui/src/components/WakeUpScreen/WakeUpScreen.stories.tsx`
- [x] T034 [US3] Extend `apps/web/cypress/e2e/wake-up.cy.ts` with "offers to try again when waking takes too long": `cy.clock()`; health always `503`; visit `/`; `cy.tick(90000)` in steps and expect the h1 "This is taking longer than usual" and a "Try again" button; switch the health stub to `200` (refresh keeps the default `401`), click "Try again", tick, and expect `/login`

**Checkpoint**: All three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T035 [P] Write `packages/ui/src/components/WakeUpScreen/WakeUpScreen.mdx` in `en` and `es` (`<Lang locale="en">` / `<Lang locale="es">`) with the five-section template from _Foundations › Documenting a component_: what it is and when to use it · why it's designed this way (honest stages instead of fake progress, silent tips, a still end frame) · how it helps the person (an explained wait lowers tension) · accessibility (live status, silent tips, `aria-busy`, reduced motion) · variants (waking, slow, offline)
- [x] T036 [P] Update `docs/design.md`: in **Motion**, add `--duration-ambient` for slow ambient loops only (the wake-up scene), always with `--easing-gentle`, ending on a complete still frame for reduced motion; in **UX patterns**, add "**Waiting:** say what is happening and roughly how long it takes, show honest stages instead of fake percentages, never an endless spinner: after a limit, offer a way forward"
- [x] T037 [P] Update `packages/ui/src/docs/05-Motion-and-tone.mdx` (en and es) with the ambient duration and the waiting pattern, matching `docs/design.md`
- [x] T038 [P] Update `docs/deploy.md` next to the "Render's free web service sleeps" note: cold starts show the wake-up screen, the web polls `/api/health` before restoring the session (why: refresh-token rotation), and a scheduled ping is a possible future improvement
- [x] T039 Run the `docs/design.md` design review checklist and the quick style grep on the new `*.module.css` files; review the scene in Storybook in light and dark, en and es, at 320 px and 200 % zoom, and with OS reduced motion on (still house with all windows lit, tips swap without fading); add any new text/UI colour pair to `packages/ui/src/tokens/contrastPairs.ts`
- [x] T040 Run quickstart scenarios 3 (API stopped, then started) and 4 (DevTools offline) from `specs/005-wake-up-loading/quickstart.md` in the browser and fix anything that differs from the expected outcomes
- [x] T041 Final gate: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter @hogar/web e2e` all green (unset `ELECTRON_RUN_AS_NODE` if Cypress complains)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish (Phase 6)**.
- **US1 (P1)** depends only on Phase 2. It creates `WakeUpScreen`, `WakeUpLoading` and the reworked `AuthProvider`.
- **US2 (P2)** depends on US1's `WakeUpScreen` (T014) and `WakeUpLoading` (T018), not on US1's E2E.
- **US3 (P3)** depends on US1's `AuthProvider` loop (T017) and `WakeUpLoading` (T018). It is independent of US2 and can run in parallel with it.

### Within each story

- Tests first (they must fail), then implementation, then E2E.
- `WakeUpScreen` (T014) → export (T015) → `WakeUpLoading` (T018) → guards (T019).
- `AuthProvider` (T017) before guards (T019) and E2E (T020).

### Parallel opportunities

- Phase 2: T002, T004, T006, T008, T009 and T010 touch different files and can all start together; T003, T005 and T007 follow their own tests.
- US1: T011, T012 and T013 in parallel; T016 in parallel with T017.
- US2 and US3 can be worked on side by side after US1, except that both edit `WakeUpLoading.tsx` (T024, T032) and `WakeUpScreen.stories.tsx` (T026, T033), so those pairs go one after the other.
- Polish: T035–T038 in parallel.

## Parallel Example: User Story 1

```text
# Tests first, together:
T011 WakeUpScreen.test.tsx
T012 AuthProvider.test.tsx
T013 WakeUpLoading.test.tsx

# Then, in parallel:
T014 WakeUpScreen.tsx + css   →  T015 export  →  T016 story
T017 AuthProvider.tsx
# Then: T018 WakeUpLoading → T019 guards → T020 E2E
```

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 and Phase 2.
2. Phase 3 (US1): the safe health-then-refresh startup and the explained wait. This alone fixes the "sent to login after a cold start" bug and replaces the bare spinner.
3. **Stop and validate** with T020 and quickstart scenario 3; it could be deployed here.

### Incremental delivery

1. US1 → the safe, honest wait (MVP).
2. US2 → the animated house and tips (the "entertaining" part).
3. US3 → slow and offline ways out.
4. Polish → docs, design review, final gate. Then open the PR to `main`.

## Phase 7: Convergence

- [x] T042 Make the wake-up status announce reliably at reveal: the `role="status"` region must already be in the DOM before its first message (for example, `WakeUpLoading` renders `WakeUpScreen` from the start with the scene hidden until `isRevealed`, or `WakeUpScreen` fills the status text after mounting), with a test in `packages/ui/src/components/WakeUpScreen/WakeUpScreen.test.tsx` or `apps/web/src/layout/WakeUpLoading.test.tsx` proving the region exists empty before the first status, per FR-011 / US2/AC4 (partial)
- [x] T043 Review the wake-up, slow and offline scenes in Storybook at 320 px width and at 200 % zoom in both locales (no horizontal scroll, no clipped text) and fix `packages/ui/src/components/WakeUpScreen/WakeUpScreen.module.css` if needed, per FR-013 / T039 (partial)
- [x] T044 Clear the 90-second give-up timer in `apps/web/src/auth/AuthProvider.tsx` as soon as the health check answers (restarting it only if a waking-type refresh failure sends the loop back to polling), with a test in `apps/web/src/auth/AuthProvider.test.tsx` where a refresh still in flight at 90 s ends `authenticated`, not `slow`, per FR-008 (partial)
