# Data Model: Wake-up loading screen

No database, Prisma or API schema changes. Everything below lives in the browser's memory for a
single page load.

## AuthState (extended, `apps/web/src/auth/AuthProvider.tsx`)

```text
AuthState =
  | { status: "loading"; user: null; phase: WaitPhase; startedAt: number; attempt: number }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: AuthUser }

WaitPhase = "waking" | "slow" | "offline"
```

| Field       | Meaning                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `phase`     | What the screen tells the person: still waking, taking longer than usual, or the device is offline.                                       |
| `startedAt` | `Date.now()` when the current wait began; stage and tip are derived from `now - startedAt`.                                               |
| `attempt`   | 0 for the first wait of the page load; incremented by `retry()` and by coming back online. `> 0` means reveal immediately (no 1 s blank). |

### State transitions

```text
                      ┌───────────── offline event ─────────────┐
                      ▼                                          │
  start ──► loading/waking ──── health 2xx ──► refresh ──┬─ 2xx ──► authenticated
     │         │   ▲  ▲                                    ├─ 4xx (not 429) ──► anonymous
     │         │   │  └──── 0 / 429 / 5xx ─────────────────┘
     │         │   └── retry() / online event (attempt + 1) ──┐
     │         ├── 90 s without health 2xx ──► loading/slow ──┘
     │         └── offline event ──► loading/offline ── online event ──► loading/waking
     └── navigator.onLine === false ──► loading/offline
```

- Leaving `loading` for `authenticated` or `anonymous` is delayed by `settleDelay(elapsed, attempt)`
  so a revealed scene stays at least `MIN_VISIBLE_MS` (FR-002).
- `slow` and `offline` stop all network attempts until `retry()` or `online`.
- The 90 s limit counts only time spent waiting for the server: it pauses while a refresh is in flight and resumes (it doesn't restart) when a failed `0`/`429`/`5xx` refresh sends the loop back to polling, after a 2 s pause.
- `onSessionExpired` (an expired session later in the app) still goes straight to `anonymous`, as
  today.

## Wake-up stage (`apps/web/src/startup/wakeUp.ts`)

| Field     | Type                                 | Rule                                              |
| --------- | ------------------------------------ | ------------------------------------------------- |
| `id`      | `"knocking" \| "lights" \| "almost"` | Also the i18n key suffix (`wakeUp.stage.<id>`).   |
| `startMs` | number                               | 0, 15 000, 35 000; ascending; the last one holds. |

`stageAt(elapsedMs)` returns the last stage whose `startMs <= elapsedMs`.

## Tip (`apps/web/src/startup/wakeUp.ts`)

| Field | Type                 | Rule                                                                                        |
| ----- | -------------------- | ------------------------------------------------------------------------------------------- |
| `id`  | one of 10 string ids | Fixed order; also the i18n key suffix (`wakeUp.tips.<id>`). Only features that exist today. |

`tipIndexAt(elapsedMs, count)` = `floor(max(0, elapsedMs - REVEAL_AFTER_MS) / TIP_INTERVAL_MS) mod count`.

## Pure helpers

| Function                          | Returns                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `isRevealed(elapsedMs, attempt)`  | `attempt > 0 \|\| elapsedMs >= REVEAL_AFTER_MS`                                                                             |
| `settleDelay(elapsedMs, attempt)` | Milliseconds to wait before leaving `loading`: 0 if never revealed, else `max(0, revealedAt + MIN_VISIBLE_MS - elapsedMs)`. |
| `isWakingError(error)`            | `true` for `ApiRequestError` with status `0`, `429` or `>= 500`, and for anything that isn't an `ApiRequestError`.          |
