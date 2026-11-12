import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api/client";
import { waitForServer } from "./waitForServer";

const unavailable = () => new ApiRequestError("server.unexpected", 503);

/** A health check that never answers until its signal is aborted. */
function hangingHealth(signal?: AbortSignal) {
  return new Promise<void>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new ApiRequestError("network", 0)));
  });
}

describe("waitForServer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves as soon as the server answers", async () => {
    const health = vi.fn(() => Promise.resolve());
    await waitForServer({ client: { health }, signal: new AbortController().signal });
    expect(health).toHaveBeenCalledOnce();
  });

  it("waits two seconds between failed attempts until the server answers", async () => {
    const health = vi
      .fn<(signal?: AbortSignal) => Promise<void>>()
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue(undefined);
    let done = false;
    const waiting = waitForServer({ client: { health }, signal: new AbortController().signal }).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(health).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(health).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(health).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    await waiting;
    expect(health).toHaveBeenCalledTimes(4);
    expect(done).toBe(true);
  });

  it("gives up on an attempt that hangs for 15 seconds and tries again", async () => {
    const signals: AbortSignal[] = [];
    const health = vi.fn((signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return signals.length === 1 ? hangingHealth(signal) : Promise.resolve();
    });
    const waiting = waitForServer({ client: { health }, signal: new AbortController().signal });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(health).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    await waiting;
    expect(health).toHaveBeenCalledTimes(2);
  });

  it("stops when the caller aborts while waiting between attempts", async () => {
    const health = vi.fn(() => Promise.reject(unavailable()));
    const controller = new AbortController();
    const waiting = waitForServer({ client: { health }, signal: controller.signal });
    const outcome = expect(waiting).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await outcome;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("stops when the caller aborts in the middle of an attempt", async () => {
    let attemptSignal: AbortSignal | undefined;
    const health = vi.fn((signal?: AbortSignal) => {
      attemptSignal = signal;
      return hangingHealth(signal);
    });
    const controller = new AbortController();
    const waiting = waitForServer({ client: { health }, signal: controller.signal });
    const outcome = expect(waiting).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(3000);
    controller.abort();
    await outcome;
    expect(attemptSignal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("does not start when the signal is already aborted", async () => {
    const health = vi.fn(() => Promise.resolve());
    const controller = new AbortController();
    controller.abort();
    await expect(waitForServer({ client: { health }, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(health).not.toHaveBeenCalled();
  });
});
