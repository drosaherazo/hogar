import type { AuthUser } from "@hogar/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ApiClient } from "../api/client";
import { hasStoredLanguage } from "../i18n";
import { pause, waitForServer } from "../startup/waitForServer";
import { GIVE_UP_AFTER_MS, isWakingError, settleDelay } from "../startup/wakeUp";

/** What the wake-up screen tells the person while the session is being restored. */
export type WaitPhase = "waking" | "slow" | "offline";

export type AuthState =
  | { status: "loading"; user: null; phase: WaitPhase; startedAt: number; attempt: number }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: AuthUser };

export interface AuthContextValue {
  state: AuthState;
  /** Starts a new wait after "taking longer than usual". Does nothing otherwise. */
  retry: () => void;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  /** Signs in with a code sent by email; the session behaves exactly like a Google one. */
  signInWithEmailCode: (email: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ANONYMOUS: AuthState = { status: "anonymous", user: null };

const waiting = (phase: WaitPhase, attempt: number): AuthState => ({
  status: "loading",
  user: null,
  phase,
  startedAt: Date.now(),
  attempt,
});

/** Pause before polling again after a refresh failed while the server was still settling. */
const RETRY_AFTER_REFRESH_MS = 2000;

const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Keeps track of who is signed in. On start it silently restores the session from the refresh
 * cookie, waiting first for the API to wake up if it was asleep (ADR 0006).
 */
export function AuthProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => waiting(isOnline() ? "waking" : "offline", 0));
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const retryRef = useRef<() => void>(() => undefined);

  // Whoever signs in next on this browser must never see the previous person's household.
  const signOutLocally = useCallback(() => {
    queryClient.clear();
    setState(ANONYMOUS);
  }, [queryClient]);

  const signIn = useCallback(
    (user: AuthUser) => {
      // Until the person picks a language, follow the one stored in their account.
      if (!hasStoredLanguage() && i18n.resolvedLanguage !== user.locale) void i18n.changeLanguage(user.locale);
      setState({ status: "authenticated", user });
      return user;
    },
    [i18n],
  );

  // The startup reads the latest signIn without restarting when its identity changes.
  const signInRef = useRef(signIn);
  useEffect(() => {
    signInRef.current = signIn;
  }, [signIn]);

  useEffect(() => client.onSessionExpired(signOutLocally), [client, signOutLocally]);

  useEffect(() => {
    let disposed = false;
    let finished = false;
    let attempt = 0;
    let phase: WaitPhase = "waking";
    let controller: AbortController | null = null;
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined;

    const show = (next: WaitPhase) => {
      phase = next;
      setState(waiting(next, attempt));
    };

    const stop = () => {
      controller?.abort();
      controller = null;
      clearTimeout(giveUpTimer);
    };

    /**
     * Health first, then exactly one refresh per healthy check. The API rotates the refresh token
     * on every use and revokes the whole session if an old one comes back, so a refresh that a
     * proxy cut off during a cold start must never be blindly retried.
     */
    const restore = async (
      signal: AbortSignal,
      giveUp: { arm: () => void; disarm: () => void },
    ): Promise<AuthUser | null> => {
      for (let first = true; ; first = false) {
        giveUp.arm();
        // After a refresh that failed while the server was settling, breathe before asking again.
        if (!first) await pause(RETRY_AFTER_REFRESH_MS, signal);
        await waitForServer({ client, signal });
        // The server answered: from here on it is "restoring the session", not "taking too long".
        giveUp.disarm();
        try {
          return (await client.refresh()).user;
        } catch (error) {
          if (!isWakingError(error)) return null;
        }
      }
    };

    const start = () => {
      stop();
      if (!isOnline()) {
        show("offline");
        return;
      }
      show("waking");
      const startedAt = Date.now();
      const current = new AbortController();
      controller = current;
      // The 90-second limit counts only time spent waiting for the server: it pauses while a
      // refresh is in flight and resumes if a failed refresh sends the loop back to polling.
      let waitedMs = 0;
      let armedAt = 0;
      const giveUp = {
        arm: () => {
          clearTimeout(giveUpTimer);
          armedAt = Date.now();
          giveUpTimer = setTimeout(
            () => {
              current.abort();
              show("slow");
            },
            Math.max(0, GIVE_UP_AFTER_MS - waitedMs),
          );
        },
        disarm: () => {
          clearTimeout(giveUpTimer);
          waitedMs += Date.now() - armedAt;
        },
      };

      restore(current.signal, giveUp).then(
        async (user) => {
          if (current.signal.aborted) return;
          clearTimeout(giveUpTimer);
          const delay = settleDelay(Date.now() - startedAt, attempt);
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          if (disposed || current.signal.aborted) return;
          finished = true;
          controller = null;
          if (user) signInRef.current(user);
          else setState(ANONYMOUS);
        },
        () => undefined, // Aborted: whoever aborted has already shown the next state.
      );
    };

    const restart = () => {
      if (finished || disposed) return;
      attempt += 1;
      start();
    };

    const onOnline = () => {
      if (phase === "offline") restart();
    };

    const onOffline = () => {
      if (finished) return;
      stop();
      show("offline");
    };

    retryRef.current = () => {
      if (phase === "slow") restart();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    start();

    return () => {
      disposed = true;
      stop();
      retryRef.current = () => undefined;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [client]);

  const retry = useCallback(() => retryRef.current(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      retry,
      loginWithGoogle: async (credential) => signIn((await client.loginWithGoogle(credential)).user),
      signInWithEmailCode: async (email, code) => signIn((await client.signInWithEmailCode(email, code)).user),
      logout: async () => {
        try {
          await client.logout();
        } finally {
          signOutLocally();
        }
      },
    }),
    [client, retry, signIn, signOutLocally, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
