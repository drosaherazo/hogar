# Contract: startup requests and web modules

## HTTP (existing endpoints, unchanged)

| Request                  | Used for                                          | Outcomes the web relies on                                                                              |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /api/health`        | Waking the server (polled)                        | `200 {"status":"ok"}` = awake. Anything else, a network error or a timeout = still waking.              |
| `POST /api/auth/refresh` | Restoring the session, **once** per healthy check | `200` `AuthResponse` = signed in. `4xx` except `429` = not signed in. `0`/`429`/`5xx` = back to waking. |

No API code changes. `/api/health` already exists in `apps/api/src/app.ts`, sits outside the auth
rate limiter and touches no database.

## `ApiClient` additions (`apps/web/src/api/client.ts`)

```ts
interface RequestOptions<T> {
  // …existing fields
  /** Cancels the request; an abort surfaces as ApiRequestError("network", 0). */
  signal?: AbortSignal;
}

class ApiClient {
  /** Resolves when the API answers 2xx; rejects with ApiRequestError otherwise. */
  health(signal?: AbortSignal): Promise<void>;
}
```

## `waitForServer` (`apps/web/src/startup/waitForServer.ts`)

```ts
export function waitForServer(options: {
  client: Pick<ApiClient, "health">;
  /** Aborted by the caller on unmount, on the 90 s limit and when going offline. */
  signal: AbortSignal;
  attemptTimeoutMs?: number; // default 15 000
  retryDelayMs?: number; // default 2 000
}): Promise<void>; // resolves once health is 2xx; rejects with an AbortError when `signal` aborts
```

## `AuthContextValue` (`apps/web/src/auth/AuthProvider.tsx`)

```ts
interface AuthContextValue {
  state: AuthState; // `loading` now carries phase, startedAt and attempt (see data-model.md)
  /** Starts a new wait after the slow state. No-op unless state is loading/slow. */
  retry: () => void;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}
```

## `startup/wakeUp.ts` exports

`REVEAL_AFTER_MS`, `MIN_VISIBLE_MS`, `TIP_INTERVAL_MS`, `GIVE_UP_AFTER_MS`, `WAKE_STAGES`, `TIP_IDS`,
`stageAt`, `tipIndexAt`, `isRevealed`, `settleDelay`, `isWakingError`. Values and rules are in
[data-model.md](../data-model.md) and [research.md](../research.md#r4-timings).
