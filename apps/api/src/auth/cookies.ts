import type { CookieOptions, Response } from "express";

export const REFRESH_COOKIE = "hogar_refresh";
/** The cookie only travels to the auth endpoints, never to the rest of the API. */
export const REFRESH_COOKIE_PATH = "/api/auth";

function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: REFRESH_COOKIE_PATH };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date, secure: boolean) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(secure), expires: expiresAt });
}

export function clearRefreshCookie(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions(secure));
}
