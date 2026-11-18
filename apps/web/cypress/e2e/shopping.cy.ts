import type { HouseholdView, MemberView, PersonRef, ShoppingItemView } from "@hogar/shared";
import { ana, session } from "../support/e2e";

// --- Stub data -----------------------------------------------------------------

const anaMember: MemberView = {
  id: "m_ana",
  userId: ana.id,
  name: ana.name,
  avatarUrl: null,
  role: "ADMIN",
  weight: 1,
  shareBps: 5000,
  joinedAt: "2026-11-10T10:00:00.000Z",
};

const household: HouseholdView = {
  id: "household_1",
  name: "Casa Ana",
  currency: "EUR",
  currencyLocked: false,
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [anaMember, { ...anaMember, id: "m_bruno", userId: "user_bruno", name: "Bruno Díaz", role: "MEMBER" }],
  splitNeedsReview: false,
  showWhoAsked: true,
};

const anaRef: PersonRef = { userId: ana.id, name: ana.name, avatarUrl: null, former: false };
const brunoRef: PersonRef = { userId: "user_bruno", name: "Bruno Díaz", avatarUrl: null, former: false };

const bread: ShoppingItemView = {
  id: "item_bread",
  name: "Bread",
  note: null,
  askedBy: brunoRef,
  addedAt: "2026-11-18T09:00:00.000Z",
  version: 1,
};

const milk: ShoppingItemView = {
  id: "item_milk",
  name: "Milk",
  note: "lactose-free",
  askedBy: anaRef,
  addedAt: "2026-11-18T10:00:00.000Z",
  version: 1,
};

// --- Flows ---------------------------------------------------------------------

describe("Shopping list", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/auth/refresh", session());
    cy.intercept("GET", "/api/household", { body: { household } });
  });

  it("adds an item from the Shopping tab and counts it on Home", () => {
    let items: ShoppingItemView[] = [bread];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items }));
    cy.intercept("POST", "/api/household/shopping/items", (req) => {
      expect(req.body).to.deep.equal({ name: "Milk", note: "lactose-free" });
      items = [bread, milk];
      req.reply({ statusCode: 201, body: { item: milk } });
    }).as("add");

    cy.visit("/");
    cy.contains("section", "Shopping").should("contain", "1 thing to buy");
    cy.get('nav[aria-label="Main"]').contains("a", "Shopping").click();
    cy.findHeading("Shopping");
    cy.contains("li", "Bread").should("contain", "asked for by Bruno Díaz");

    cy.contains("label", "What's needed?").click();
    cy.focused().type("Milk");
    cy.contains("label", "Note (optional)").click();
    cy.focused().type("lactose-free{enter}");

    cy.wait("@add");
    cy.contains("[role=status]", "You added Milk");
    cy.get("main li").should("have.length", 2).last().should("contain", "Milk").and("contain", "lactose-free");
    cy.contains("li", "Milk").should("not.contain", "asked for by");
    cy.contains("label", "What's needed?").next("input").should("have.value", "").and("have.focus");

    cy.get('nav[aria-label="Main"]').contains("a", "Home").click();
    cy.contains("section", "Shopping").should("contain", "2 things to buy");
  });

  it("kindly says when something is already on the list", () => {
    cy.intercept("GET", "/api/household/shopping", { body: { items: [milk] } });
    cy.intercept("POST", "/api/household/shopping/items", {
      statusCode: 409,
      body: { error: { code: "shopping.item.duplicate" } },
    });

    cy.visit("/shopping");
    cy.contains("label", "What's needed?").click();
    cy.focused().type("  MILK {enter}");
    cy.contains("[role=status]", "Milk is already on the list.");
    cy.get("main li").should("have.length", 1);
  });

  it("shows what a second person adds while the list is open", () => {
    let items: ShoppingItemView[] = [bread];
    let reads = 0;
    cy.intercept("GET", "/api/household/shopping", (req) => {
      reads += 1;
      req.reply({ items });
    });

    cy.visit("/shopping");
    cy.contains("li", "Bread");
    cy.task("socket:connection");
    // The first read, then the one connecting makes to catch up: anything newer comes from the event.
    cy.wrap(null).should(() => expect(reads).to.equal(2));

    // Bruno adds milk on his phone: the API now lists it and announces the change.
    cy.then(() => {
      items = [bread, { ...milk, askedBy: brunoRef }];
    });
    cy.task("socket:emit", "shopping:changed");

    cy.get("main li")
      .should("have.length", 2)
      .last()
      .should("contain", "Milk")
      .and("contain", "asked for by Bruno Díaz");
  });
});
