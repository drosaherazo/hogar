import { describe, expect, it } from "vitest";
import { formatTimeLeft } from "./timeLeft";

const now = new Date("2026-11-11T10:00:00.000Z");

describe("formatTimeLeft", () => {
  it("speaks in hours while more than an hour is left", () => {
    expect(formatTimeLeft("2026-11-11T22:00:00.000Z", "en", now)).toBe("in 12 hours");
    expect(formatTimeLeft("2026-11-11T22:00:00.000Z", "es", now)).toBe("dentro de 12 horas");
  });

  it("switches to minutes in the last hour, never showing zero", () => {
    expect(formatTimeLeft("2026-11-11T10:25:00.000Z", "en", now)).toBe("in 25 minutes");
    expect(formatTimeLeft("2026-11-11T10:00:10.000Z", "en", now)).toBe("in 1 minute");
  });
});
