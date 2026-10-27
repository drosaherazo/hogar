import type { AuthResponse, AuthUser, ErrorCode } from "@hogar/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const ana: AuthUser = {
  id: "user_ana",
  email: "ana@example.com",
  name: "Ana García",
  avatarUrl: null,
  locale: "en",
};

export function session(user: AuthUser = ana, accessToken = "access-1"): AuthResponse {
  return { accessToken, user };
}

export const apiError = (status: number, code: ErrorCode) => HttpResponse.json({ error: { code } }, { status });

/** By default nobody is signed in: refresh answers 401 and logout succeeds. */
export const server = setupServer(
  http.post("*/api/auth/refresh", () => apiError(401, "auth.session.missing")),
  http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
);

export const handlers = {
  signedIn: (user: AuthUser = ana) => http.post("*/api/auth/refresh", () => HttpResponse.json(session(user))),
  googleLogin: (user: AuthUser = ana) => http.post("*/api/auth/google", () => HttpResponse.json(session(user))),
  googleLoginFails: (code: ErrorCode) => http.post("*/api/auth/google", () => apiError(401, code)),
};
