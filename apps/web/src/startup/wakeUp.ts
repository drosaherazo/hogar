import { ApiRequestError } from "../api/client";

/**
 * Timings of the wake-up screen shown while the API wakes from sleep (a cold start takes
 * 30–50 seconds on the free plan). Elapsed time always comes from `Date.now()`, never from counting
 * ticks, so a tab that was in the background shows the right stage and tip when it comes back.
 */

/** Answers faster than this never show the scene, so a warm start doesn't flash. */
export const REVEAL_AFTER_MS = 1000;
/** Once shown, the scene stays at least this long so it doesn't look like a flicker. */
export const MIN_VISIBLE_MS = 500;
/** How long each tip stays on screen. */
export const TIP_INTERVAL_MS = 7000;
/** After this long without an answer, the screen offers to try again. */
export const GIVE_UP_AFTER_MS = 90_000;

/** Honest status steps based on elapsed time; the last one holds until the answer arrives. */
export const WAKE_STAGES = [
  { id: "knocking", startMs: 0 },
  { id: "lights", startMs: 15_000 },
  { id: "almost", startMs: 35_000 },
] as const;

export type WakeStage = (typeof WAKE_STAGES)[number];
export type WakeStageId = WakeStage["id"];

/** Tips about features that exist today, in the order they are shown. */
export const TIP_IDS = [
  "inviteLink",
  "weights",
  "exactCents",
  "customSplit",
  "settleUp",
  "fixMistakes",
  "guests",
  "movedOut",
  "darkTheme",
  "language",
] as const;

export type TipId = (typeof TIP_IDS)[number];

export function stageAt(elapsedMs: number): WakeStage {
  let current: WakeStage = WAKE_STAGES[0];
  for (const stage of WAKE_STAGES) if (elapsedMs >= stage.startMs) current = stage;
  return current;
}

export function tipIndexAt(elapsedMs: number, count: number): number {
  return Math.floor(Math.max(0, elapsedMs - REVEAL_AFTER_MS) / TIP_INTERVAL_MS) % count;
}

/** The first wait starts with a calm, empty page; later attempts show the scene straight away. */
export function isRevealed(elapsedMs: number, attempt: number): boolean {
  return attempt > 0 || elapsedMs >= REVEAL_AFTER_MS;
}

/** How long to keep the scene before leaving it, so it is never on screen for less than MIN_VISIBLE_MS. */
export function settleDelay(elapsedMs: number, attempt: number): number {
  if (!isRevealed(elapsedMs, attempt)) return 0;
  const revealedAt = attempt > 0 ? 0 : REVEAL_AFTER_MS;
  return Math.max(0, revealedAt + MIN_VISIBLE_MS - elapsedMs);
}

/**
 * Whether a failed startup request means "the server is still waking" rather than a real answer:
 * no response at all, rate limiting or any 5xx (a proxy page while the instance boots).
 */
export function isWakingError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}
