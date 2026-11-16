import { vi } from "vitest";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";
import { createAppUpdate } from "../update/appUpdate";

/**
 * vite-plugin-pwa's `registerSW` without a browser: the real update logic runs on top, and the test
 * says when a new version arrives (`arrive`) or takes over this window (`takeOver`).
 */
export function fakeServiceWorker() {
  let options: RegisterSWOptions = {};
  const handOver = vi.fn(() => Promise.resolve());
  const reload = vi.fn();
  const update = createAppUpdate({
    registerSW: (registered) => {
      options = registered;
      return handOver;
    },
    reload,
  });
  return {
    update,
    /** "Update" told the waiting version to take over. */
    handOver,
    /** This window reloaded. */
    reload,
    arrive: () => options.onNeedRefresh?.(),
    takeOver: () => options.onNeedReload?.(),
  };
}
