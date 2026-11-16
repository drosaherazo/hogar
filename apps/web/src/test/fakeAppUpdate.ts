import { vi } from "vitest";
import type { AppUpdate } from "../update/appUpdate";

/** A service worker stand-in: `arrive()` makes a new version wait; `apply` records "Update". */
export function fakeAppUpdate() {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    get ready() {
      return ready;
    },
    onReadyChange(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply: vi.fn(() => Promise.resolve()),
    arrive() {
      ready = true;
      listeners.forEach((listener) => listener());
    },
  } satisfies AppUpdate & { arrive: () => void };
}
