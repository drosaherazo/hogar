import { API_VERSION, type AuthResponse, type ErrorCode, type HouseholdView } from "@hogar/shared";
import { ana, session, setPageVisibility } from "../support/e2e";

function household(overrides: Partial<HouseholdView> = {}): HouseholdView {
  return {
    id: "household_1",
    name: "Casa Ana",
    currency: "EUR",
    currencyLocked: false,
    myMembershipId: "m_ana",
    myRole: "ADMIN",
    members: [
      {
        id: "m_ana",
        userId: ana.id,
        name: ana.name,
        avatarUrl: null,
        role: "ADMIN",
        weight: 1,
        shareBps: 10000,
        joinedAt: "2026-11-10T10:00:00.000Z",
      },
    ],
    splitNeedsReview: false,
    showWhoAsked: true,
    ...overrides,
  };
}

const showHousehold = (name: string) =>
  cy.intercept("GET", "/api/household", { body: { household: household({ name }) } }).as("household");

describe("Live household", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/auth/refresh", session()).as("refresh");
  });

  it("shows another person's rename as soon as it happens", () => {
    showHousehold("Casa Ana");
    cy.visit("/");
    cy.contains("h2", "Casa Ana");
    cy.task("socket:connection").should("deep.equal", { token: "e2e-access-token", apiVersion: API_VERSION });

    // Bruno renames the household on his phone: the API now answers with the new name and says so.
    showHousehold("Nuestra casa");
    cy.task("socket:emit", "household:changed");

    cy.contains("h2", "Nuestra casa");
  });

  it("renews an access token the live connection refuses, and connects with the new one", () => {
    let refreshes = 0;
    cy.intercept("POST", "/api/auth/refresh", (req) => {
      refreshes += 1;
      const renewed: AuthResponse = { accessToken: `e2e-access-token-${refreshes}`, user: ana };
      req.reply(renewed);
    });
    cy.task("socket:refuse", ["auth.token.invalid"]);
    showHousehold("Casa Ana");

    cy.visit("/");

    cy.task("socket:connection").should("deep.equal", { token: "e2e-access-token-2", apiVersion: API_VERSION });
  });

  it("still shows what changed while the page was away when the live connection can't get back in", () => {
    showHousehold("Casa Ana");
    cy.visit("/");
    cy.contains("h2", "Casa Ana");
    cy.task("socket:connection");

    setPageVisibility("hidden");
    // Meanwhile Bruno renames the household, and the server can't let Ana's screen back in.
    showHousehold("Nuestra casa");
    cy.task("socket:refuse", Array<ErrorCode>(10).fill("server.unexpected"));
    setPageVisibility("visible");

    cy.contains("h2", "Nuestra casa");
  });

  it("shows the required update when the live connection says this version is too old", () => {
    cy.task("socket:refuse", ["client.outdated"]);
    showHousehold("Casa Ana");

    cy.visit("/");

    cy.contains("Hogar has been updated");
    cy.contains("button", "Update");
  });
});
