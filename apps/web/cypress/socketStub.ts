import { createServer } from "node:http";
// Types only: Cypress and Vite load this file with plain Node, which can't read the shared sources.
import type { ClientToServerEvents, ErrorCode, HouseholdEvent, ServerToClientEvents, SOCKET_PATH } from "@hogar/shared";
import { Server } from "socket.io";

/** Where the stub listens; in E2E mode Vite forwards the live connection here (vite.config.ts). */
export const E2E_SOCKET_PORT = 5190;

/** The web's live connection path; the type keeps it equal to the shared constant. */
export const E2E_SOCKET_PATH: typeof SOCKET_PATH = "/api/socket.io";

/**
 * E2E runs without the API (every request is stubbed with `cy.intercept`), so the web's real
 * Socket.io client connects to this stand-in instead. A test plays the other person by changing
 * the stubbed responses and emitting the event the API would emit. Cypress starts it once for the
 * whole run (cypress.config.ts) and drives it through these tasks.
 */
export function startSocketStub() {
  let refusals: ErrorCode[] = [];
  let waiting: ((auth: unknown) => void)[] = [];

  const io = new Server<ClientToServerEvents, ServerToClientEvents>({
    path: E2E_SOCKET_PATH,
    transports: ["websocket"],
    serveClient: false,
  });
  io.use((_socket, next) => {
    const refusal = refusals.shift();
    next(refusal === undefined ? undefined : new Error(refusal));
  });
  io.on("connection", (socket) => {
    for (const resolve of waiting) resolve(socket.handshake.auth);
    waiting = [];
  });
  const http = createServer();
  io.attach(http);
  const listening = new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(E2E_SOCKET_PORT, resolve);
  });

  return {
    /**
     * Closes every connection and forgets earlier refusals. A page the server disconnects doesn't
     * try to reconnect, so the page a test leaves open stays quiet afterwards.
     */
    async "socket:reset"() {
      await listening;
      io.disconnectSockets();
      refusals = [];
      waiting = [];
      return null;
    },
    /** The next handshakes are refused with these codes, one each; later ones get in. */
    "socket:refuse"(codes: ErrorCode[]) {
      refusals = [...codes];
      return null;
    },
    /** Waits until the web is connected, and answers with what its handshake sent. */
    "socket:connection"(): Promise<unknown> {
      const connected = io.sockets.sockets.values().next().value;
      if (connected) return Promise.resolve(connected.handshake.auth);
      return new Promise((resolve, reject) => {
        waiting.push(resolve);
        setTimeout(() => reject(new Error("The web never opened its live connection")), 10_000);
      });
    },
    /** The household announces `event` to every connected screen. */
    "socket:emit"(event: HouseholdEvent) {
      io.emit(event);
      return null;
    },
  };
}
