import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../api/client";
import {
  GIVE_UP_AFTER_MS,
  isRevealed,
  isWakingError,
  MIN_VISIBLE_MS,
  REVEAL_AFTER_MS,
  settleDelay,
  stageAt,
  TIP_IDS,
  TIP_INTERVAL_MS,
  tipIndexAt,
} from "./wakeUp";

describe("wake-up timings", () => {
  it("uses the agreed values", () => {
    expect(REVEAL_AFTER_MS).toBe(1000);
    expect(MIN_VISIBLE_MS).toBe(500);
    expect(TIP_INTERVAL_MS).toBe(7000);
    expect(GIVE_UP_AFTER_MS).toBe(90_000);
  });
});

describe("stageAt", () => {
  it.each([
    [0, "knocking"],
    [14_999, "knocking"],
    [15_000, "lights"],
    [34_999, "lights"],
    [35_000, "almost"],
    [10_000_000, "almost"],
  ])("%i ms → %s", (elapsed, stage) => {
    expect(stageAt(elapsed).id).toBe(stage);
  });
});

describe("tipIndexAt", () => {
  it("shows the first tip from the reveal until one interval later", () => {
    expect(tipIndexAt(0, 10)).toBe(0);
    expect(tipIndexAt(1000, 10)).toBe(0);
    expect(tipIndexAt(7999, 10)).toBe(0);
    expect(tipIndexAt(8000, 10)).toBe(1);
  });

  it("shows every tip once before repeating, then wraps around", () => {
    const seen = Array.from({ length: 10 }, (_, step) => tipIndexAt(1000 + step * TIP_INTERVAL_MS, 10));
    expect(new Set(seen).size).toBe(10);
    expect(tipIndexAt(1000 + 10 * TIP_INTERVAL_MS, 10)).toBe(0);
  });
});

describe("TIP_IDS", () => {
  it("has ten unique tips", () => {
    expect(TIP_IDS).toHaveLength(10);
    expect(new Set(TIP_IDS).size).toBe(10);
  });
});

describe("isRevealed", () => {
  it("waits a second on the first attempt and shows straight away on later ones", () => {
    expect(isRevealed(999, 0)).toBe(false);
    expect(isRevealed(1000, 0)).toBe(true);
    expect(isRevealed(0, 1)).toBe(true);
  });
});

describe("settleDelay", () => {
  it.each([
    [300, 0, 0],
    [999, 0, 0],
    [1000, 0, 500],
    [1300, 0, 200],
    [1500, 0, 0],
    [40_000, 0, 0],
    [100, 1, 400],
    [600, 1, 0],
  ])("elapsed %i ms on attempt %i → wait %i ms", (elapsed, attempt, delay) => {
    expect(settleDelay(elapsed, attempt)).toBe(delay);
  });
});

describe("isWakingError", () => {
  it.each([0, 429, 500, 502, 503, 504])("status %i means the server is still waking", (status) => {
    expect(isWakingError(new ApiRequestError(status === 0 ? "network" : "server.unexpected", status))).toBe(true);
  });

  it.each([400, 401, 403, 404])("status %i is a real answer", (status) => {
    expect(isWakingError(new ApiRequestError("auth.session.missing", status))).toBe(false);
  });

  it("treats unknown failures as still waking", () => {
    expect(isWakingError(new Error("boom"))).toBe(true);
  });
});
