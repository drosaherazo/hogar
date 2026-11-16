import type { AuthUser } from "@hogar/shared";
import { createContext, useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { WakeUpLoading } from "../layout/WakeUpLoading";
import { OfflineEmpty } from "../offline/OfflineEmpty";
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
  if (state.status === "loading") return <WakeUpLoading />;
  if (state.status === "offline" && !state.user) return <OfflineEmpty />;
  if (state.status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies LoginState} />;
  }
  return (
    <CurrentUserContext.Provider value={state.user}>
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

/** The signed-in user, for pages behind `RequireAuth`. */
export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
