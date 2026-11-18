import type { HouseholdEvent } from "@hogar/shared";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { householdKeys, useHousehold } from "../household/useHousehold";

/** What the live connection reports to the app. */
export interface HouseholdEventsHandlers {
  /**
   * The server let the connection in (again), or says this person has no household any more:
   * whatever changed while disconnected must be re-read.
   */
  catchUp(): void;
  /** Something changed in the household. */
  received(event: HouseholdEvent): void;
}

/** Opens the household's live connection; the function it returns closes it. */
export type HouseholdEventsSource = (handlers: HouseholdEventsHandlers) => () => void;

const HouseholdEventsContext = createContext<HouseholdEventsSource | null>(null);

/** Gives the app its live connection: Socket.io in the app, a fake in tests. */
export function HouseholdEventsProvider({ source, children }: { source: HouseholdEventsSource; children: ReactNode }) {
  return <HouseholdEventsContext.Provider value={source}>{children}</HouseholdEventsContext.Provider>;
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Whether Hogar is on screen: not in a background tab, a minimised window or a locked phone. */
function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeToVisibility, () => document.visibilityState === "visible");
}

/** The queries each event makes stale. */
const staleAfter: Record<HouseholdEvent, QueryKey> = {
  // Names, roles and the split show on every page, so every household query is re-read.
  "household:changed": householdKeys.current,
};

/**
 * Keeps one live connection to the household while a signed-in person with a household has Hogar
 * on screen, so what others change appears without reloading. Events are signals: they only mark
 * the household's queries stale, so TanStack Query stays the one place data lives, and a
 * reconnection re-reads everything it may have missed.
 *
 * Why only while visible: Render's free plan gives the API 750 hours a month, shared with `dev`,
 * and a socket's heartbeat keeps the service awake. A background tab gains nothing from live
 * updates (there are no push notifications), so it lets the service sleep (docs/deploy.md).
 */
export function LiveHousehold() {
  const source = useContext(HouseholdEventsContext);
  if (!source) throw new Error("LiveHousehold must be used inside <HouseholdEventsProvider>");
  const queryClient = useQueryClient();
  const householdId = useHousehold().data?.household?.id;
  const visible = usePageVisible();

  useEffect(() => {
    if (!householdId || !visible) return;
    const markStale = (queryKey: QueryKey) => void queryClient.invalidateQueries({ queryKey });
    return source({
      catchUp: () => markStale(householdKeys.current),
      received: (event) => markStale(staleAfter[event]),
    });
  }, [source, queryClient, householdId, visible]);

  return null;
}
