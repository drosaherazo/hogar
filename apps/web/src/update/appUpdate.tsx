import { createContext, useContext, type ReactNode } from "react";

/** A new version of Hogar, downloaded by the service worker and waiting to take over. */
export interface AppUpdate {
  /** Whether a new version is waiting. */
  readonly ready: boolean;
  /** Runs `listener` when `ready` changes. */
  onReadyChange(listener: () => void): () => void;
  /**
   * Hands over to the waiting version and reloads. With none waiting yet, it looks for one first,
   * since a reload alone would open the cached old version again; without a service worker (a
   * browser that has none, development) it just reloads.
   */
  apply(): Promise<void>;
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
