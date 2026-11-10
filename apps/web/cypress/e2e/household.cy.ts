import type { HouseholdView, InvitationPreview, MemberView } from "@hogar/shared";
import { ana, session } from "../support/e2e";

const anaMember: MemberView = {
  id: "m_ana",
  userId: ana.id,
  name: ana.name,
  avatarUrl: null,
  role: "ADMIN",
  weight: 1,
  shareBps: 10000,
  joinedAt: "2026-11-10T10:00:00.000Z",
};

const brunoMember: MemberView = {
  ...anaMember,
  id: "m_bruno",
  userId: "user_bruno",
  name: "Bruno Díaz",
  role: "MEMBER",
};

function household(overrides: Partial<HouseholdView> = {}): HouseholdView {
  return {
    id: "household_1",
    name: "Casa Ana",
    myMembershipId: "m_ana",
    myRole: "ADMIN",
    members: [anaMember],
    splitNeedsReview: false,
    ...overrides,
  };
}

const withBruno = (overrides: Partial<HouseholdView> = {}) =>
  household({
    members: [
      { ...anaMember, shareBps: 5000 },
      { ...brunoMember, shareBps: 5000 },
    ],
    ...overrides,
  });

function preview(overrides: Partial<InvitationPreview> = {}): InvitationPreview {
  return {
    householdName: "Casa Ana",
    inviterName: "Ana García",
    role: "MEMBER",
    expiresAt: "2026-11-11T22:00:00.000Z",
    viewer: "can_join",
    ...overrides,
  };
}

describe("Households", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/auth/refresh", session()).as("refresh");
  });

  it("creates a household from the empty home", () => {
    cy.intercept("POST", "/api/household", (req) => {
      expect(req.body).to.deep.equal({ name: "Casa Ana" });
      req.reply({ statusCode: 201, body: { household: household() } });
    }).as("create");

    cy.visit("/");
    cy.contains("You're not part of a household yet");
    cy.contains("button", "Create a household").click();
    cy.get("[role=dialog]").within(() => {
      cy.contains("label", "Household name").click();
      cy.focused().type("Casa Ana");
      cy.contains("button", "Create household").click();
    });
    cy.wait("@create");
    cy.contains("h2", "Casa Ana");
    cy.contains("1 person lives here");
  });

  it("invites someone, and sees them after they join", () => {
    cy.intercept("GET", "/api/household", { body: { household: household() } }).as("household");
    cy.intercept("GET", "/api/household/invitations", { body: { invitations: [] } });
    cy.intercept("POST", "/api/household/invitations", (req) => {
      expect(req.body).to.deep.equal({ role: "MEMBER" });
      req.reply({
        statusCode: 201,
        body: {
          invitation: {
            id: "inv_1",
            role: "MEMBER",
            createdByName: ana.name,
            expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
            status: "pending",
          },
          token: "tok_e2e",
        },
      });
    }).as("invite");

    cy.visit("/household/settings");
    cy.contains("button", "Invite someone").click();
    cy.get("[role=dialog]").contains("button", "Create link").click();
    cy.wait("@invite");
    cy.get("[role=dialog]")
      .contains("label", "Invitation link")
      .parent()
      .find("input")
      .should("have.value", `${Cypress.config("baseUrl")}/invite#tok_e2e`);
    cy.get("[role=dialog]").contains("button", "Done").click();

    // Bruno accepts on his own phone: the API now returns him as a member.
    cy.intercept("GET", "/api/household", { body: { household: withBruno({ splitNeedsReview: true }) } });
    cy.contains("a", "Back to home").click();
    cy.contains("2 people live here");
    cy.contains("Bruno Díaz");
    cy.contains("Review the split");
  });

  it("joins a household from an invitation link", () => {
    cy.intercept("POST", "/api/invitations/lookup", (req) => {
      expect(req.body).to.deep.equal({ token: "tok_join" });
      req.reply(preview());
    });
    cy.intercept("POST", "/api/invitations/accept", { body: { household: withBruno({ myRole: "MEMBER" }) } }).as(
      "accept",
    );

    cy.visit("/invite#tok_join");
    cy.contains("Ana García invites you to join Casa Ana as a member.");
    // From now on the API knows Bruno's household, as the real server would after accepting.
    cy.intercept("GET", "/api/household", { body: { household: withBruno({ myRole: "MEMBER" }) } });
    cy.contains("button", "Join Casa Ana").click();
    cy.wait("@accept");
    cy.location("pathname").should("eq", "/");
    cy.contains("h2", "Casa Ana");
  });

  it("explains links that can't be used, and people who already have a household", () => {
    cy.intercept("POST", "/api/invitations/lookup", {
      statusCode: 410,
      body: { error: { code: "invitation.used" } },
    });
    cy.visit("/invite#tok_used");
    cy.findHeading("This invitation can't be used");
    cy.contains("This invitation has already been used.");

    cy.intercept("POST", "/api/invitations/lookup", preview({ viewer: "has_other_household" }));
    cy.visit("/invite#tok_other");
    cy.contains("You already belong to another household.");
    cy.contains("button", "Leave my household");
  });

  it("edits the split and clears the review banner", () => {
    cy.intercept("GET", "/api/household", { body: { household: withBruno({ splitNeedsReview: true }) } });
    cy.intercept("GET", "/api/household/invitations", { body: { invitations: [] } });
    cy.intercept("PUT", "/api/household/split", (req) => {
      expect(req.body).to.deep.equal({
        weights: [
          { membershipId: "m_ana", weight: 3 },
          { membershipId: "m_bruno", weight: 1 },
        ],
      });
      req.reply({
        household: withBruno({
          members: [
            { ...anaMember, weight: 3, shareBps: 7500 },
            { ...brunoMember, weight: 1, shareBps: 2500 },
          ],
        }),
      });
    }).as("split");

    cy.visit("/");
    cy.contains("a", "Review split").click();
    cy.location("hash").should("eq", "#split");
    cy.contains("label", "Ana García").parent().find("input").clear().type("3");
    cy.contains("75% of shared costs");
    cy.contains("25% of shared costs");
    cy.contains("button", "Save split").click();
    cy.wait("@split");
    cy.contains("Split saved.");
    cy.contains("Review the split").should("not.exist");
  });
});
