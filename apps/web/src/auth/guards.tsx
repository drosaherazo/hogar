import type { AuthUser } from "@hogar/shared";
import { createContext, useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { WakeUpLoading } from "../layout/WakeUpLoading";
import { useAuth } from "./AuthProvider";

const CurrentUserContext = createContext<AuthUser | null>(null);

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

/** Only signed-in people get through; everyone else goes to the login page and comes back afterwards. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <WakeUpLoading />;
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

/** The login page is only for people who aren't signed in yet. */
export function RedirectIfAuthenticated() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <WakeUpLoading />;
  if (state.status === "authenticated") {
    return <Navigate to={safeReturnPath((location.state as LoginState | null)?.from)} replace />;
  }
  return <Outlet />;
}

/** The signed-in user, for pages behind `RequireAuth`. */
export function useCurrentUser(): AuthUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
