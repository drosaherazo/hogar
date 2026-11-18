import type { AuthUser, CurrentHousehold } from "@hogar/shared";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { householdKeys } from "../household/useHousehold";
import { WakeUpLoading } from "../layout/WakeUpLoading";
import { OfflineEmpty } from "../offline/OfflineEmpty";
import { LiveHousehold } from "../realtime/LiveHousehold";
import { useAuth } from "./AuthProvider";

/** Who "you" is on a signed-in page: the session's person, or offline the person the kept data belongs to. */
export type CurrentUser = Pick<AuthUser, "id" | "name" | "locale" | "avatarUrl">;

const CurrentUserContext = createContext<CurrentUser | null>(null);

interface LoginState {
  /** Where the person was going (path, query and #fragment) before being asked to sign in. */
  from?: string;
}

/**
 * Only paths inside the app are followed after signing in ("/invite#…"), never other sites
 * ("//evil.example", "https://…"), so the login page can't be used as an open redirect.
 */
export function safeReturnPath(from: unknown): string {
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/\\")
    ? from
    : "/";
}

/**
 * Only signed-in people get through; everyone else goes to the login page and comes back afterwards.
 * Offline, the installed app shows the last person's kept data read-only, or a friendly empty state.
 */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  const keptHousehold = useKeptHousehold();
  if (state.status === "loading") return <WakeUpLoading />;
  if (state.status === "offline") {
    // Kept data is still being read from the device: a moment, then the page or the empty state.
    if (keptHousehold === "restoring") return null;
    if (!state.user || !keptHousehold) return <OfflineEmpty />;
  }
  if (state.status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies LoginState} />;
  }
  return (
    <CurrentUserContext.Provider value={state.user}>
      {/* Offline there is nothing to connect to: the kept data stays as it is (ADR 0015). */}
      {state.status === "authenticated" && <LiveHousehold />}
      <Outlet />
    </CurrentUserContext.Provider>
  );
}

/** The login page is only for people who aren't signed in yet (nobody can sign in offline). */
export function RedirectIfAuthenticated() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <WakeUpLoading />;
  if (state.status === "offline" && !state.user) return <OfflineEmpty />;
  if (state.status === "authenticated" || state.status === "offline") {
    return <Navigate to={safeReturnPath((location.state as LoginState | null)?.from)} replace />;
  }
  return <Outlet />;
}

/** Whether the device kept a household to show offline: pages without one would only spin. */
function useKeptHousehold(): boolean | "restoring" {
  const restoring = useIsRestoring();
  const queryClient = useQueryClient();
  if (restoring) return "restoring";
  return queryClient.getQueryData<CurrentHousehold>(householdKeys.current)?.household != null;
}

/** The signed-in user, for pages behind `RequireAuth`. */
export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
