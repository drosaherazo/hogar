import { errorCodeSchema, SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from "@hogar/shared";
import { io, type Socket } from "socket.io-client";
import type { ApiClient } from "../api/client";
import type { HouseholdEventsSource } from "./LiveHousehold";

/**
 * The household's live connection over Socket.io, on the web's own origin: Vercel's `/api/*`
 * rewrite and Vite's dev proxy forward it to the API like any request (docs/deploy.md).
 *
 * WebSocket only, never long-polling: browsers always send `Origin` on a WebSocket handshake, which
 * the API checks, but not on a same-origin polling request.
 *
 * Socket.io reconnects on its own after a lost connection. A handshake the API refuses doesn't, so
 * each refusal is handled here:
 * - `client.outdated`: the required update screen.
 * - `auth.token.invalid`: the 15-minute access token expired (a phone unlocked after a while):
 *   renew it like a request would, and connect again, once.
 * - `household.not_member`: re-read the household; the app then finds none and stops connecting.
 *
 * Whatever happens, a page shown again re-reads what it missed once, so a connection that can't get
 * in leaves it without live updates, never with old data.
 */
export function socketHouseholdEvents(client: ApiClient): HouseholdEventsSource {
  return (handlers) => {
    let closed = false;
    let sentToken = "";
    let renewed = false;
    let caughtUp = false;
    const catchUp = () => {
      caughtUp = true;
      handlers.catchUp();
    };

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      path: SOCKET_PATH,
      transports: ["websocket"],
      auth: (send) => {
        const auth = client.realtimeAuth();
        sentToken = auth.token;
        send(auth);
      },
    });

    socket.on("connect", () => {
      renewed = false;
      catchUp();
    });
    socket.on("household:changed", () => handlers.received("household:changed"));
    socket.on("connect_error", (error) => {
      // Lost on the way rather than refused: Socket.io tries again on its own.
      const refusal = socket.active ? undefined : errorCodeSchema.safeParse(error.message).data;
      if (refusal === "client.outdated") {
        client.reportOutdated();
      } else if (refusal === "household.not_member") {
        catchUp();
      } else if (refusal === "auth.token.invalid" && !renewed) {
        // A fresh token refused as well wouldn't fare better a second time.
        renewed = true;
        client.renewAccessToken(sentToken).then(
          () => {
            if (!closed) socket.connect();
          },
          () => undefined, // The session ended: the app signs out and closes this connection.
        );
      } else if (!caughtUp) {
        catchUp();
      }
    });

    return () => {
      closed = true;
      socket.disconnect();
    };
  };
}
