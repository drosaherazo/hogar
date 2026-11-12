# Quickstart: validating the wake-up loading screen

## Prerequisites

- `pnpm install`, env files copied (see `CLAUDE.md`).
- No database is needed for the web checks below; the API is only needed for scenario 5.

## 1. Automated checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm --filter @hogar/ui test          # WakeUpScreen incl. axe, tokens
pnpm --filter @hogar/web test         # wakeUp helpers, waitForServer, client, AuthProvider, WakeUpLoading, i18n parity
pnpm --filter @hogar/web e2e          # existing flows + wake-up.cy.ts (unset ELECTRON_RUN_AS_NODE if needed)
```

Expected: everything green. `wake-up.cy.ts` proves that a signed-in deep link survives a long wake
(SC-001) and that the slow state's "Try again" restarts the wait.

## 2. Storybook

```bash
pnpm --filter @hogar/ui storybook
```

Open **Components › WakeUpScreen**. Check `Waking`, `Slow` and `Offline` in light and dark themes
and in both locales. Then turn on reduced motion in the OS: the house is still, with all windows lit,
and the tip changes without fading.

## 3. Simulated cold start in the browser (no API needed)

Run the web app (`pnpm --filter @hogar/web dev`) with the API **stopped**, then open
`http://localhost:5173/expenses`.

- 0–1 s: an empty page, with no spinner flash.
- From 1 s: the house, "Knocking on your home's door…", the description and a tip.
- Around 15 s and 35 s: the status changes; a new tip every ~7 s with no repeats.
- At 90 s: "This is taking longer than usual" with **Try again**, and the house stops moving.
- Start the API, press **Try again**: you land on `/login` (no cookie) or on `/expenses` (signed in).

## 4. Offline

With the API still stopped, open the app and wait for the wake-up screen. Then, in DevTools ›
Network, choose **Offline**: the screen says "You seem to be offline" and polling stops. Switch
back to **No throttling**: the wait starts again on its own. (Reloading while offline only shows
the browser's own error page, because the app itself can't load.)

## 5. Real deploy (after merge)

Leave the production API idle for over 15 minutes, then open a deep link while signed in. You land
on that page, still signed in, after the wake-up screen, and never see the login page.

## 6. Design review

Run the `docs/design.md` checklist and the quick style grep on the new `*.module.css` files.
