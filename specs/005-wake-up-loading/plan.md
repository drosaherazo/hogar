# Implementation Plan: Wake-up loading screen

**Branch**: `feat/wake-up-loading` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-wake-up-loading/spec.md`

## Summary

Replace the startup spinner with a joyful, honest waiting scene and make the startup itself safe
for a sleeping server.

1. **Safe wake-up protocol (P1):** the app polls `GET /api/health` until the API answers and only
   then sends one `POST /api/auth/refresh`. Today a refresh cut by the proxy during a cold start
   sends signed-in people to the login page. Retrying refreshes blindly could even trip the API's
   token-reuse protection and sign them out everywhere ([research R1](./research.md#r1-how-the-app-waits-for-a-sleeping-server-without-breaking-the-session)).
2. **The scene (P1–P2):** a new copy-free `WakeUpScreen` in `packages/ui` with an inline SVG house
   whose windows light up. In `apps/web`, a `WakeUpLoading` wrapper derives the status stage and a
   rotating tip from elapsed time and translates them.
3. **Ways out (P3):** a slow state at 90 s with "Try again", and an offline state that resumes on
   its own.

No API, database or shared-package changes.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), CSS Modules, MDX (Storybook docs)

**Primary Dependencies**: React, React Router, TanStack Query, react-i18next (web); clsx (ui). No
new packages.

**Storage**: N/A (in-memory state for one page load)

**Testing**: Vitest + Testing Library (+ axe in ui), fake timers; Cypress with `cy.clock()` and
stubbed `/api/health` and `/api/auth/refresh`

**Target Platform**: Modern evergreen browsers, mobile-first (320 px and up)

**Project Type**: Web application (pnpm monorepo: `apps/web`, `packages/ui`; `apps/api` unchanged)

**Performance Goals**: Warm start adds at most one extra small request (< 1 s reveal threshold, so it
is invisible). The ambient animation uses only `opacity`/`transform` on SVG parts and no JS timers
for motion. The stage/tip clock re-renders at most once per second.

**Constraints**: Never refresh the session more than once per healthy check; durations from tokens
only; reduced motion respected via `base.css`; every string through i18n; AA contrast in both themes.

**Scale/Scope**: 1 new ui component, 2 new web modules plus 1 replaced layout component, 1 provider
change, 20 i18n keys per locale, 1 motion token, 1 new E2E spec.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                            | Assessment                                                                                                                                                                                                                                                                           | Status |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| **I. Small, Polished and Deployed**  | One screen plus the startup logic behind it, finished end to end (web, ui, tests, i18n, docs). No new packages. One new motion token, justified in R6. Keeping the server warm is recorded as future work, not built.                                                                | ✅     |
| **II. Domain Integrity**             | No money, split or balance logic touched. Tips describe the existing rules accurately (exact cents, weights).                                                                                                                                                                        | ✅ N/A |
| **III. Server-Side Security**        | No endpoint changes. The design _protects_ the rotating refresh token by never retrying a refresh that might have reached the server (R1). `/api/health` exposes nothing sensitive and is already public.                                                                            | ✅     |
| **IV. Tested by Default**            | Unit tests for timing helpers, `waitForServer`, the client and `AuthProvider`; component test with axe plus stories for `WakeUpScreen`; Cypress for a long wake on a deep link and for the slow state. No new endpoint, so no new Supertest test is required.                        | ✅     |
| **V. Fully Internationalized**       | 20 keys in `en` and `es` ([contracts/i18n-keys.md](./contracts/i18n-keys.md)); `WakeUpScreen` takes all copy via props; locale comes from the stored preference or the browser before sign-in, as today.                                                                             | ✅     |
| **VI. Joyful and Accessible Design** | Brand illustration with tokens only; a polite live region for status, silent tips, `aria-busy`, keyboard "Try again"; reduced-motion end frame; both themes; bilingual MDX docs. `docs/design.md` gains the ambient-duration rule and a "waiting" UX pattern (no silent exceptions). | ✅     |
| **Tech constraints**                 | `ui` imports nothing from `shared` or apps; `web → ui` only. CSS Modules + `clsx`. Strict TS, no `any`.                                                                                                                                                                              | ✅     |
| **Scope**                            | MVP polish that serves auth (in scope). No gamification: tips and an illustration, no game.                                                                                                                                                                                          | ✅     |
| **Workflow**                         | Own branch `feat/wake-up-loading`, Conventional Commits, spec folder committed with the feature.                                                                                                                                                                                     | ✅     |

**Post-design re-check (after Phase 1):** still all ✅. The design added no dependency, layer or
endpoint. The only additions beyond the obvious are the `--duration-ambient` token (needed to keep
"durations only from tokens" honest) and the `signal` option on the client (needed for per-attempt
timeouts). Neither requires Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-wake-up-loading/
├── spec.md
├── plan.md              # This file
├── research.md          # R1–R10: wake protocol, error classes, timings, placement, motion, a11y, testing
├── data-model.md        # Extended AuthState, stages, tips, pure helpers, state transitions
├── quickstart.md        # How to validate (automated, Storybook, simulated cold start, offline, prod)
├── contracts/
│   ├── wake-up-screen.md   # WakeUpScreen props, behaviour, tests, stories
│   ├── startup-api.md      # health/refresh outcomes, ApiClient.health, waitForServer, AuthContext.retry
│   └── i18n-keys.md        # 20 new keys in en and es
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/ui/src/
├── components/WakeUpScreen/
│   ├── WakeUpScreen.tsx            # new: scene + inline SVG house, copy via props
│   ├── WakeUpScreen.module.css     # new: layout, ambient keyframes (--duration-ambient)
│   ├── WakeUpScreen.test.tsx       # new: structure, live region, axe in all moods
│   ├── WakeUpScreen.stories.tsx    # new: Waking, WakingSpanish, Slow, Offline
│   └── WakeUpScreen.mdx            # new: bilingual docs, five-section template
├── tokens/primitives.css           # + --duration-ambient
├── docs/05-Motion-and-tone.mdx     # + ambient duration and the waiting scene
└── index.ts                        # + export WakeUpScreen

apps/web/src/
├── api/client.ts                   # + RequestOptions.signal, health()
├── api/client.test.ts              # + health and abort tests
├── startup/
│   ├── wakeUp.ts                   # new: constants, stages, tip ids, stageAt, tipIndexAt, isRevealed, settleDelay, isWakingError
│   ├── wakeUp.test.ts              # new
│   ├── waitForServer.ts            # new: health polling with per-attempt timeout and abort
│   └── waitForServer.test.ts       # new
├── auth/AuthProvider.tsx           # loading phases, 90 s limit, offline/online, retry(), settle delay
├── auth/AuthProvider.test.tsx      # new: startup scenarios with fake timers
├── auth/guards.tsx                 # FullPageLoading → WakeUpLoading
├── auth/guards.test.tsx            # adapt to the extended loading state
├── layout/WakeUpLoading.tsx        # new: replaces FullPageLoading (+ .module.css for the pre-reveal page)
├── layout/WakeUpLoading.test.tsx   # new: reveal/min-visible, stage and tip rotation, slow/offline
├── layout/FullPageLoading.tsx      # removed (+ its .module.css)
└── i18n/locales/{en,es}/common.json  # + wakeUp.*, − loading

apps/web/cypress/
├── support/e2e.ts                  # + default GET /api/health → 200
└── e2e/wake-up.cy.ts               # new: long wake on a deep link; slow state and Try again

docs/
├── design.md                       # Motion: --duration-ambient; UX patterns: waiting
└── deploy.md                       # note that cold starts show the wake-up screen
```

**Structure Decision**: existing monorepo layout. Presentational scene in `packages/ui`;
startup logic in a new `apps/web/src/startup/` folder (pure, testable, owned by neither auth nor
layout); `AuthProvider` stays the single owner of the startup session check. `apps/api` and
`packages/shared` are untouched.

## Complexity Tracking

No violations to justify.
