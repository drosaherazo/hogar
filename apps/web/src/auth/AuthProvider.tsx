import type { AuthUser } from "@hogar/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ApiClient } from "../api/client";
import { hasStoredLanguage } from "../i18n";

export type AuthState =
  { status: "loading"; user: null } | { status: "anonymous"; user: null } | { status: "authenticated"; user: AuthUser };

export interface AuthContextValue {
  state: AuthState;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ANONYMOUS: AuthState = { status: "anonymous", user: null };

/** Keeps track of who is signed in. On start it silently restores the session from the refresh cookie. */
export function AuthProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });
  const { i18n } = useTranslation();

  const signIn = useCallback(
    (user: AuthUser) => {
      // Until the person picks a language, follow the one stored in their account.
      if (!hasStoredLanguage() && i18n.resolvedLanguage !== user.locale) void i18n.changeLanguage(user.locale);
      setState({ status: "authenticated", user });
      return user;
    },
    [i18n],
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = client.onSessionExpired(() => setState(ANONYMOUS));
    client.refresh().then(
      ({ user }) => active && signIn(user),
      () => active && setState(ANONYMOUS),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, signIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      loginWithGoogle: async (credential) => signIn((await client.loginWithGoogle(credential)).user),
      logout: async () => {
        try {
          await client.logout();
        } finally {
          setState(ANONYMOUS);
        }
      },
    }),
    [client, signIn, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
