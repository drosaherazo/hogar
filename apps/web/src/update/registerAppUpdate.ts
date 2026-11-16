import { registerSW } from "virtual:pwa-register";
import type { AppUpdate } from "./appUpdate";

/** How long "Update" waits for a version it just found to finish downloading. */
const DOWNLOAD_WAIT_MS = 5000;

/**
 * Registers the service worker in prompt mode: it never reloads on its own. New versions are
 * looked for when the app opens and whenever it becomes visible again; a version the person
 * leaves for later takes over on the next cold start.
 */
export function registerAppUpdate(): AppUpdate {
  let ready = false;
  let registration: ServiceWorkerRegistration | undefined;
  const listeners = new Set<() => void>();

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach((listener) => listener());
    },
    onRegisteredSW(_url, registered) {
      registration = registered;
    },
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
  });

  const waitUntilReady = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        listeners.delete(done);
        resolve();
      };
      const timer = setTimeout(done, DOWNLOAD_WAIT_MS);
      listeners.add(done);
    });

  return {
    get ready() {
      return ready;
    },
    onReadyChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async apply() {
      if (!ready && registration) {
        const found = waitUntilReady();
        await registration.update().catch(() => undefined);
        if (registration.installing || registration.waiting) await found;
      }
      if (ready) await updateServiceWorker(true);
      else window.location.reload();
    },
  };
}
