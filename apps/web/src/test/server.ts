import type { AuthResponse, AuthUser, ErrorCode, HouseholdView, MemberView } from "@hogar/shared";
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

export function member(overrides: Partial<MemberView> & Pick<MemberView, "id" | "name">): MemberView {
  return {
    userId: `user_${overrides.id}`,
    avatarUrl: null,
    role: "MEMBER",
    weight: 1,
    shareBps: 0,
    joinedAt: "2026-11-10T10:00:00.000Z",
    ...overrides,
  };
}

/** Ana's household as she sees it; override members, role or flags per test. */
export function householdView(overrides: Partial<HouseholdView> = {}): HouseholdView {
  return {
    id: "household_1",
    name: "Casa Ana",
    myMembershipId: "m_ana",
    myRole: "ADMIN",
    members: [member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 1, shareBps: 10000 })],
    splitNeedsReview: false,
    ...overrides,
  };
}

export const handlers = {
  signedIn: (user: AuthUser = ana) => http.post("*/api/auth/refresh", () => HttpResponse.json(session(user))),
  noHousehold: (removedFrom: string | null = null) =>
    http.get("*/api/household", () => HttpResponse.json({ household: null, removedFrom })),
  household: (household: HouseholdView = householdView()) =>
    http.get("*/api/household", () => HttpResponse.json({ household })),
  googleLogin: (user: AuthUser = ana) => http.post("*/api/auth/google", () => HttpResponse.json(session(user))),
  googleLoginFails: (code: ErrorCode) => http.post("*/api/auth/google", () => apiError(401, code)),
};
