import { useCallback, useSyncExternalStore } from "react";
import { useApiClient } from "../api/ApiClientContext";
import { useAuth } from "../auth/AuthProvider";

/**
 * Whether Hogar can reach its server right now: the browser says it is online and the last
 * request got an answer. Without a connection the installed app shows the offline view (ADR 0015).
 */
export function useOnline(): boolean {
  const client = useApiClient();
  const subscribe = useCallback(
    (onChange: () => void) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      const stopListening = client.onReachabilityChange(onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
        stopListening();
      };
    },
    [client],
  );
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false && client.isReachable);
}

/**
 * Whether changes are off: without a connection, and also while the offline view still shows kept
 * data as the session comes back underneath (nothing can be sent before it does).
 */
export function useReadOnly(): boolean {
  const online = useOnline();
  const { state } = useAuth();
  return !online || state.status === "offline";
}
