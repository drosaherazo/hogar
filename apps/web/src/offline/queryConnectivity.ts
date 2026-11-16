import { onlineManager } from "@tanstack/react-query";

let held = false;

const browserOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Data queries follow the browser's connection, like TanStack Query's default, but they also start
 * from it (the default assumes a connection) and can be held. Opened offline, queries pause on the
 * kept data instead of failing over it (ADR 0015).
 */
export function followBrowserConnection() {
  held = false;
  onlineManager.setEventListener((setOnline) => {
    const update = () => setOnline(!held && browserOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  });
}

/**
 * Holds data queries while the offline view shows kept data, and lets them go once the session is
 * restored. Otherwise they would resume the moment the connection returns, before the health check
 * and the single refresh of ADR 0006, and refresh the session on their own.
 */
export function holdQueries(hold: boolean) {
  held = hold;
  onlineManager.setOnline(!held && browserOnline());
}
