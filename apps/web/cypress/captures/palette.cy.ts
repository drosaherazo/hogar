import type { ActivityPage, BalancesView, HouseholdView, MemberView, PersonRef } from "@hogar/shared";
import { ana, session } from "../support/e2e";

/**
 * Before/after screenshots of the key screens in both themes, for the palette ADR
 * (docs/adr/0004-vibrant-palette.md). Not an E2E test: it lives outside cypress/e2e so CI
 * never runs it. Run it with `pnpm --filter @hogar/web capture`.
 */

const member = (id: string, userId: string, name: string, role: MemberView["role"], weight: number): MemberView => ({
  id,
  userId,
  name,
  avatarUrl: null,
  role,
  weight,
  shareBps: 0,
  joinedAt: "2026-11-10T10:00:00.000Z",
});

const household: HouseholdView = {
  id: "household_1",
  name: "Casa Ana",
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [
    { ...member("m_ana", ana.id, ana.name, "ADMIN", 2), shareBps: 5000 },
    { ...member("m_bruno", "user_bruno", "Bruno Díaz", "MEMBER", 1), shareBps: 2500 },
    { ...member("m_carla", "user_carla", "Carla Ruiz", "MEMBER", 1), shareBps: 2500 },
  ],
  splitNeedsReview: false,
};

const ref = (userId: string, name: string): PersonRef => ({ userId, name, avatarUrl: null, former: false });
const anaRef = ref(ana.id, ana.name);
const brunoRef = ref("user_bruno", "Bruno Díaz");
const carlaRef = ref("user_carla", "Carla Ruiz");

/** Ana is owed by Bruno and owes Carla a little, so both state colors show up. */
const balances: BalancesView = {
  balances: [
    { person: anaRef, balanceCents: 1070 },
    { person: brunoRef, balanceCents: -1520 },
    { person: carlaRef, balanceCents: 450 },
  ],
  suggestions: [
    { from: brunoRef, to: anaRef, amountCents: 1070 },
    { from: brunoRef, to: carlaRef, amountCents: 450 },
  ],
  myBalanceCents: 1070,
};

const noActivity: ActivityPage = { items: [], nextCursor: null };

const themes = ["light", "dark"] as const;

function visitIn(theme: (typeof themes)[number], path: string) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem("hogar-theme", theme);
    },
  });
}

// Full-page screenshots sometimes stall in headless Electron; give them room and a retry.
const shot = { capture: "fullPage", timeout: 60_000 } as const;

describe("Palette captures", { retries: 2 }, () => {
  for (const theme of themes) {
    it(`captures the signed-out login screen (${theme})`, () => {
      visitIn(theme, "/login");
      cy.findHeading("Welcome to Hogar");
      cy.screenshot(`login-${theme}`, shot);
    });

    describe(`signed in (${theme})`, () => {
      beforeEach(() => {
        cy.intercept("POST", "/api/auth/refresh", session());
        cy.intercept("GET", "/api/household", { body: { household } });
        cy.intercept("GET", "/api/household/balances", balances);
        cy.intercept("GET", "/api/household/activity*", noActivity);
      });

      it("captures home", () => {
        visitIn(theme, "/");
        cy.findHeading("Hi, Ana");
        cy.contains("You're owed €10.70 in total");
        cy.screenshot(`home-${theme}`, shot);
      });

      it("captures balances", () => {
        visitIn(theme, "/balances");
        cy.findHeading("Balances");
        cy.contains("Bruno Díaz owes you €10.70");
        cy.screenshot(`balances-${theme}`, shot);
      });

      it("captures the expense form", () => {
        visitIn(theme, "/expenses/new");
        cy.findHeading("Add an expense");
        cy.contains("label", "What was it?");
        cy.screenshot(`expense-form-${theme}`, shot);
      });
    });
  }
});
