import { createContext, useContext, type ReactNode } from "react";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";

/** A new version of Hogar, downloaded by the service worker and waiting to take over. */
export interface AppUpdate {
  /** Whether a new version is waiting. */
  readonly ready: boolean;
  /** Whether the person chose "Later" for it: the notice stays away until Hogar opens again. */
  readonly postponed: boolean;
  /** Runs `listener` whenever `ready` or `postponed` changes. */
  onChange(listener: () => void): () => void;
  postpone(): void;
  /**
   * Hands over to the waiting version and reloads this window. With none waiting yet it looks for
   * one first, since a plain reload would open the cached old version again; without a service
   * worker (a browser without one, development) it just reloads.
   */
  apply(): Promise<void>;
}

type RegisterSW = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

/** How long "Update" waits for a version it has just found to finish downloading. */
const DOWNLOAD_WAIT_MS = 10_000;

/**
 * The update notice's logic over vite-plugin-pwa's `registerSW`, in prompt mode: nothing ever
 * reloads on its own. Only the window where the person pressed "Update" reloads; other open
 * windows keep what they are doing and get the new version the next time they open. New versions
 * are looked for when the app opens and whenever it becomes visible again.
 */
export function createAppUpdate({
  registerSW,
  reload = () => window.location.reload(),
}: {
  registerSW: RegisterSW;
  reload?: () => void;
}): AppUpdate {
  let ready = false;
  let postponed = false;
  let applying = false;
  let registration: ServiceWorkerRegistration | undefined;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  const handOver = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      changed();
    },
    // The plugin reloads every window by default; only the one that asked may.
    onNeedReload() {
      if (applying) reload();
    },
    onRegisteredSW(_url, registered) {
      registration = registered;
    },
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
  });

  /** Resolves once a version just found is waiting, has taken over (first install) or gave up. */
  const settled = (incoming: ServiceWorker) =>
    new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        listeners.delete(onReady);
        incoming.removeEventListener("statechange", onState);
        resolve();
      };
      const onReady = () => ready && finish();
      const onState = () => ["activated", "redundant"].includes(incoming.state) && finish();
      const timer = setTimeout(finish, DOWNLOAD_WAIT_MS);
      listeners.add(onReady);
      incoming.addEventListener("statechange", onState);
      onState(); // It may have finished already.
    });

  return {
    get ready() {
      return ready;
    },
    get postponed() {
      return postponed;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    postpone() {
      postponed = true;
      changed();
    },
    async apply() {
      if (!ready && registration) {
        await registration.update().catch(() => undefined);
        const incoming = registration.installing ?? registration.waiting;
        if (incoming && !ready) await settled(incoming);
      }
      if (ready) {
        applying = true;
        await handOver(true);
      } else {
        reload();
      }
    },
  };
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

export function AppUpdateProvider({ update, children }: { update: AppUpdate; children: ReactNode }) {
  return <AppUpdateContext.Provider value={update}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate(): AppUpdate {
  const update = useContext(AppUpdateContext);
  if (!update) throw new Error("useAppUpdate must be used inside <AppUpdateProvider>");
  return update;
}
