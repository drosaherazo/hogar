import type { ApiClient } from "../api/client";

export interface WaitForServerOptions {
  client: Pick<ApiClient, "health">;
  /** Aborted by the caller on unmount, after the give-up limit and when the device goes offline. */
  signal: AbortSignal;
  /** How long one health check may take before it is abandoned. */
  attemptTimeoutMs?: number;
  /** Pause between a failed health check and the next one. */
  retryDelayMs?: number;
}

const abortError = () => new DOMException("The wait was cancelled", "AbortError");

/**
 * Polls the API's health check until it answers, so the session is only restored once the
 * server is awake (see docs/adr/0006-wake-the-api-before-refreshing.md). Any failure means "still
 * waking"; only aborting `signal` stops it, rejecting with an AbortError.
 */
export async function waitForServer({
  client,
  signal,
  attemptTimeoutMs = 15_000,
  retryDelayMs = 2000,
}: WaitForServerOptions): Promise<void> {
  for (;;) {
    if (signal.aborted) throw abortError();
    if (await attempt(client, signal, attemptTimeoutMs)) return;
    await pause(retryDelayMs, signal);
  }
}

/** One health check, abandoned after `timeoutMs` or when `signal` aborts. Resolves to whether it succeeded. */
async function attempt(client: WaitForServerOptions["client"], signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal.addEventListener("abort", abort);
  try {
    await client.health(controller.signal);
    return true;
  } catch {
    if (signal.aborted) throw abortError();
    return false;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

/** Waits `ms`, rejecting with an AbortError as soon as `signal` aborts. */
export function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
