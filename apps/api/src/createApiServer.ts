import { createServer } from "node:http";
import { createApp, type AppDeps } from "./app";
import { createRealtime } from "./realtime/realtime";

/**
 * The API as it runs: the Express app and its Socket.io server on one HTTP server, with the
 * services publishing household events to the sockets. Call `listen` on `server`.
 */
export function createApiServer(deps: Omit<AppDeps, "events">) {
  const realtime = createRealtime(deps);
  const app = createApp({ ...deps, events: realtime.events });
  const server = createServer(app);
  realtime.attach(server);
  return { app, server, close: () => realtime.close() };
}
