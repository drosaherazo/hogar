import type { AuthUser } from "@hogar/shared";
import { createContext, useContext } from "react";
import { Navigate, Outlet } from "react-router";
import { FullPageLoading } from "../layout/FullPageLoading";
import { useAuth } from "./AuthProvider";

const CurrentUserContext = createContext<AuthUser | null>(null);

/** Only signed-in people get through; everyone else goes to the login page. */
export function RequireAuth() {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageLoading />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  return (
    <CurrentUserContext.Provider value={state.user}>
      <Outlet />
    </CurrentUserContext.Provider>
  );
}

/** The login page is only for people who aren't signed in yet. */
export function RedirectIfAuthenticated() {
  const { state } = useAuth();
  if (state.status === "loading") return <FullPageLoading />;
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}

/** The signed-in user, for pages behind `RequireAuth`. */
export function useCurrentUser(): AuthUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <RequireAuth>");
  return user;
}
