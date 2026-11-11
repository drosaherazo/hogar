import type {
  ActivityItem,
  ActivityPage,
  AuthResponse,
  AuthUser,
  BalancesView,
  ErrorCode,
  ExpenseView,
  HouseholdView,
  MemberView,
  PersonRef,
  SettlementView,
} from "@hogar/shared";
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

/**
 * By default nobody is signed in: refresh answers 401 and logout succeeds. Balances default to
 * "all square", so pages that show a balance sentence work without setting them up.
 */
export const server = setupServer(
  http.post("*/api/auth/refresh", () => apiError(401, "auth.session.missing")),
  http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("*/api/household/balances", () => HttpResponse.json(balancesView())),
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

/** Ana (ADMIN, weight 3) and Bruno (MEMBER, weight 1): 75 % and 25 % of shared costs. */
export function homeView(overrides: Partial<HouseholdView> = {}): HouseholdView {
  return householdView({
    members: [
      member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 3, shareBps: 7500 }),
      member({ id: "m_bruno", name: "Bruno Díaz", weight: 1, shareBps: 2500, joinedAt: "2026-11-10T10:00:01.000Z" }),
    ],
    ...overrides,
  });
}

export function personRef(overrides: Partial<PersonRef> & Pick<PersonRef, "userId" | "name">): PersonRef {
  return { avatarUrl: null, former: false, ...overrides };
}

export const anaRef = personRef({ userId: ana.id, name: ana.name });
export const brunoRef = personRef({ userId: "user_m_bruno", name: "Bruno Díaz" });

/** Groceries, €42.80, paid by Ana, with the 3 / 1 household split. */
export function expenseView(overrides: Partial<ExpenseView> = {}): ExpenseView {
  return {
    id: "expense_1",
    description: "Groceries",
    amountCents: 4280,
    date: "2026-11-10",
    paidBy: anaRef,
    split: {
      method: "WEIGHTS",
      shares: [
        { person: anaRef, amountCents: 3210 },
        { person: brunoRef, amountCents: 1070 },
      ],
    },
    createdBy: anaRef,
    createdAt: "2026-11-10T10:00:00.000Z",
    editedBy: null,
    editedAt: null,
    version: 1,
    ...overrides,
  };
}

/** Everyone square unless overridden. */
export function balancesView(overrides: Partial<BalancesView> = {}): BalancesView {
  return { balances: [], suggestions: [], myBalanceCents: 0, ...overrides };
}

/** Ana is owed €7.70 by Bruno. */
export function anaIsOwed(): BalancesView {
  return balancesView({
    balances: [
      { person: anaRef, balanceCents: 770 },
      { person: brunoRef, balanceCents: -770 },
    ],
    suggestions: [{ from: brunoRef, to: anaRef, amountCents: 770 }],
    myBalanceCents: 770,
  });
}

/** Bruno paid Ana €7.70, recorded by Ana. */
export function settlementView(overrides: Partial<SettlementView> = {}): SettlementView {
  return {
    id: "settlement_1",
    from: brunoRef,
    to: anaRef,
    amountCents: 770,
    date: "2026-11-10",
    createdBy: anaRef,
    createdAt: "2026-11-10T10:00:00.000Z",
    editedBy: null,
    editedAt: null,
    version: 1,
    ...overrides,
  };
}

type SettlementItem = Extract<ActivityItem, { kind: "settlement" }>;

export function settlementItem(overrides: Partial<SettlementItem> = {}): SettlementItem {
  return {
    kind: "settlement",
    id: "settlement_1",
    amountCents: 770,
    date: "2026-11-10",
    from: brunoRef,
    to: anaRef,
    deleted: null,
    ...overrides,
  };
}

type ExpenseItem = Extract<ActivityItem, { kind: "expense" }>;

export function expenseItem(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    kind: "expense",
    id: "expense_1",
    description: "Groceries",
    amountCents: 4280,
    date: "2026-11-10",
    paidBy: anaRef,
    viewerPart: { kind: "lent", amountCents: 1070 },
    deleted: null,
    ...overrides,
  };
}

export const handlers = {
  signedIn: (user: AuthUser = ana) => http.post("*/api/auth/refresh", () => HttpResponse.json(session(user))),
  /** Serves `pages` in order: the first without a cursor, then the one after each `nextCursor`. */
  activity: (...pages: ActivityPage[]) =>
    http.get("*/api/household/activity", ({ request }) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      const index = cursor === null ? 0 : pages.findIndex((page, at) => pages[at - 1]?.nextCursor === cursor);
      return HttpResponse.json(pages[Math.max(index, 0)] ?? { items: [], nextCursor: null });
    }),
  expense: (expense: ExpenseView = expenseView()) =>
    http.get("*/api/household/expenses/:id", () => HttpResponse.json({ expense })),
  balances: (view: BalancesView = anaIsOwed()) => http.get("*/api/household/balances", () => HttpResponse.json(view)),
  settlement: (settlement: SettlementView = settlementView()) =>
    http.get("*/api/household/settlements/:id", () => HttpResponse.json({ settlement })),
  noHousehold: (removedFrom: string | null = null) =>
    http.get("*/api/household", () => HttpResponse.json({ household: null, removedFrom })),
  household: (household: HouseholdView = householdView()) =>
    http.get("*/api/household", () => HttpResponse.json({ household })),
  googleLogin: (user: AuthUser = ana) => http.post("*/api/auth/google", () => HttpResponse.json(session(user))),
  googleLoginFails: (code: ErrorCode) => http.post("*/api/auth/google", () => apiError(401, code)),
};
