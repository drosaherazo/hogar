import type { HouseholdView, MemberView, PersonRef, ShoppingItemView } from "@hogar/shared";
import { ana, openInBackground, session, setPageVisibility } from "../support/e2e";

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
  cartOwner: null,
};

const milk: ShoppingItemView = {
  id: "item_milk",
  name: "Milk",
  note: "lactose-free",
  askedBy: anaRef,
  addedAt: "2026-11-18T10:00:00.000Z",
  version: 1,
  cartOwner: null,
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

    // Opened in a background tab: the list goes live once Ana looks at it, after its first read.
    cy.visit("/shopping", { onBeforeLoad: openInBackground });
    cy.contains("li", "Bread");
    setPageVisibility("visible");
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

  it("edits an item someone changed meanwhile, saving the person's version once they've seen theirs", () => {
    let items: ShoppingItemView[] = [milk];
    const edits: unknown[] = [];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items }));
    cy.intercept("PATCH", "/api/household/shopping/items/item_milk", (req) => {
      edits.push(req.body);
      if (req.body.version === 1) {
        // Bruno saved "oat" a moment earlier.
        items = [{ ...milk, note: "oat", version: 2 }];
        req.reply({ statusCode: 409, body: { error: { code: "shopping.item.changed" } } });
      } else {
        const saved = { ...milk, note: "soy", version: 3 };
        items = [saved];
        req.reply({ item: saved });
      }
    });

    cy.visit("/shopping");
    cy.get('button[aria-label="Options for Milk"]').click();
    cy.contains("[role=menuitem]", "Edit").click();
    cy.contains("[role=dialog]", "Edit “Milk”").within(() => {
      cy.contains("label", "Note (optional)").click();
      cy.focused().clear().type("soy{enter}");
      cy.contains("[role=status]", "Someone changed this meanwhile").should("contain", "oat");
      cy.contains("button", "Keep the new version").should("have.focus");
      cy.contains("button", "Save mine").should("be.enabled").click();
    });

    cy.contains("[role=status]", "Changes to Milk saved");
    cy.get("[role=dialog]").should("not.exist");
    cy.contains("li", "Milk").should("contain", "soy");
    cy.wrap(edits).should("deep.equal", [
      { name: "Milk", note: "soy", version: 1 },
      { name: "Milk", note: "soy", version: 2 },
    ]);
  });

  it("deletes an item at once and brings it back with Undo, from a toast above the tab bar", () => {
    let items: ShoppingItemView[] = [bread, milk];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items }));
    cy.intercept("DELETE", "/api/household/shopping/items/item_bread*", (req) => {
      expect(req.url).to.contain("version=1");
      items = [milk];
      req.reply({ statusCode: 204 });
    }).as("delete");
    cy.intercept("POST", "/api/household/shopping/items/item_bread/restore", (req) => {
      items = [bread, milk];
      req.reply({ item: bread });
    }).as("restore");

    cy.visit("/shopping");
    cy.get('button[aria-label="Options for Bread"]').click();
    cy.contains("[role=menuitem]", "Delete").click();
    cy.wait("@delete");
    cy.get("main li").should("have.length", 1);

    cy.get('[role=region][aria-label="Notifications"]').contains("[role=alertdialog]", "You deleted Bread").as("toast");
    cy.get('nav[aria-label="Main"]').then(($nav) => {
      cy.get("@toast").should(($toast) => {
        expect($toast[0]?.getBoundingClientRect().bottom).to.be.at.most(
          $nav[0]?.getBoundingClientRect().top ?? Number.NaN,
        );
      });
    });
    cy.get("@toast").contains("button", "Undo").click();

    cy.wait("@restore");
    cy.contains("[role=status]", "Bread is back on the list");
    cy.get("main li").should("have.length", 2).first().should("contain", "Bread");
    cy.get("[role=alertdialog]").should("not.exist");
  });
});
