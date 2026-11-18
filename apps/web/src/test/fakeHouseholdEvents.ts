import type { HouseholdEvent } from "@hogar/shared";
import type { HouseholdEventsHandlers, HouseholdEventsSource } from "../realtime/LiveHousehold";

/**
 * The household's live connection without a socket server: the web's real logic runs on top, and
 * the test says when the server lets the connection in (`connect`) and when an event arrives
 * (`emit`). Nothing connects unless the test says so, so other tests never see extra requests.
 */
export function fakeHouseholdEvents() {
  const open = new Set<HouseholdEventsHandlers>();
  const source: HouseholdEventsSource = (handlers) => {
    open.add(handlers);
    return () => open.delete(handlers);
  };
  return {
    source,
    /** Whether the web has a connection open (or opening) right now. */
    get isOpen() {
      return open.size > 0;
    },
    /** The server let the open connection in. */
    connect: () => open.forEach((handlers) => handlers.catchUp()),
    emit: (event: HouseholdEvent) => open.forEach((handlers) => handlers.received(event)),
  };
}

export type FakeHouseholdEvents = ReturnType<typeof fakeHouseholdEvents>;
