import { googleLoginRequestSchema, type AuthResponse } from "@hogar/shared";
import { Router, type Response } from "express";
import { badRequest } from "../httpError";
import type { AuthService, Session } from "./authService";
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from "./cookies";

export function createAuthRouter(auth: AuthService, { cookieSecure }: { cookieSecure: boolean }) {
  const router = Router();

  function respondWithSession(res: Response, session: Session) {
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt, cookieSecure);
    const body: AuthResponse = { accessToken: session.accessToken, user: session.user };
    res.set("Cache-Control", "no-store").json(body);
  }

  router.post("/google", async (req, res) => {
    const parsed = googleLoginRequestSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest();
    respondWithSession(res, await auth.loginWithGoogle(parsed.data.credential, req.get("accept-language")));
  });

  router.post("/refresh", async (req, res) => {
    try {
      respondWithSession(res, await auth.refresh(readRefreshCookie(req.cookies)));
    } catch (error) {
      // A refresh that fails leaves no usable session behind: drop the cookie too.
      clearRefreshCookie(res, cookieSecure);
      throw error;
    }
  });

  router.post("/logout", async (req, res) => {
    await auth.logout(readRefreshCookie(req.cookies));
    clearRefreshCookie(res, cookieSecure);
    res.status(204).end();
  });

  return router;
}

function readRefreshCookie(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
