import type { ExpenseView, HouseholdView, MemberView, PersonRef, ShoppingItemView } from "@hogar/shared";
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
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: null }));
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
    cy.get("main [role=combobox]").should("have.value", "").and("have.focus");

    cy.get('nav[aria-label="Main"]').contains("a", "Home").click();
    cy.contains("section", "Shopping").should("contain", "2 things to buy");
  });

  it("suggests what the household bought, and one tap fills the name and its last note", () => {
    cy.intercept("GET", "/api/household/shopping", { body: { items: [bread], lastCategoryId: null } });
    cy.intercept("GET", "/api/household/shopping/suggestions*", (req) => {
      req.reply({
        body: {
          suggestions: [
            { name: "Milk", note: "lactose-free", timesBought: 6 },
            { name: "Mint", note: null, timesBought: 1 },
          ],
        },
        delay: 200,
      });
    });
    cy.intercept("POST", "/api/household/shopping/items", (req) => {
      expect(req.body).to.deep.equal({ name: "Milk", note: "lactose-free" });
      req.reply({ statusCode: 201, body: { item: milk } });
    }).as("add");

    cy.visit("/shopping");
    cy.contains("label", "What's needed?").click();
    cy.focused().type("mi");
    cy.contains("[role=option]", "Milk").should("contain", "lactose-free · Bought 6 times");
    cy.contains("[role=option]", "Mint").should("contain", "Bought once").click();
    cy.get("main [role=combobox]").should("have.value", "Mint");

    cy.get("main [role=combobox]").clear().type("mi");
    cy.contains("[role=option]", "Milk").click();
    cy.get("main [role=combobox]").should("have.value", "Milk");
    cy.contains("label", "Note (optional)").next("input").should("have.value", "lactose-free");
    cy.contains("button", "Add").click();

    cy.wait("@add");
    cy.contains("[role=status]", "You added Milk");
  });

  it("kindly says when something is already on the list", () => {
    cy.intercept("GET", "/api/household/shopping", { body: { items: [milk], lastCategoryId: null } });
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
      req.reply({ items, lastCategoryId: null });
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

  it("shows a second person taking an item into their cart while the list is open, locking it for Ana", () => {
    let items: ShoppingItemView[] = [bread, milk];
    let reads = 0;
    cy.intercept("GET", "/api/household/shopping", (req) => {
      reads += 1;
      req.reply({ items, lastCategoryId: null });
    });

    // Opened in a background tab: the list goes live once Ana looks at it, after its first read.
    cy.visit("/shopping", { onBeforeLoad: openInBackground });
    cy.contains("li", "Bread");
    setPageVisibility("visible");
    // The first read, then the one connecting makes to catch up: anything newer comes from the event.
    cy.wrap(null).should(() => expect(reads).to.equal(2));
    cy.get('input[aria-label="Put Milk in your cart"]').should("be.enabled");

    // Bruno, in the shop, takes the milk: the API now lists it in his cart and announces the change.
    cy.then(() => {
      items = [bread, { ...milk, cartOwner: brunoRef }];
    });
    cy.task("socket:emit", "shopping:changed");

    cy.contains("li", "Milk").should("contain", "In Bruno Díaz's cart");
    cy.get('input[aria-label="Put Milk in your cart"]').should("be.disabled");
    cy.contains("li", "Bread").should("not.contain", "cart");
    cy.get('button[aria-label="Options for Milk"]').click();
    for (const action of ["Edit", "Delete"]) {
      cy.contains("[role=menuitem]", action)
        .should("have.attr", "aria-disabled", "true")
        .and("contain", "Only Bruno Díaz can change it while it's in their cart.");
    }
  });

  it("puts an item in Ana's cart with one tap, and says so when Bruno got to another one first", () => {
    let items: ShoppingItemView[] = [bread, milk];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: null }));
    cy.intercept("PUT", "/api/household/shopping/items/item_bread/cart", (req) => {
      items = [{ ...bread, cartOwner: anaRef }, milk];
      req.reply({ item: items[0] });
    }).as("bread");
    cy.intercept("PUT", "/api/household/shopping/items/item_milk/cart", (req) => {
      // Bruno tapped the milk a moment earlier.
      items = [
        { ...bread, cartOwner: anaRef },
        { ...milk, cartOwner: brunoRef },
      ];
      req.reply({ statusCode: 409, body: { error: { code: "shopping.item.in_cart" } } });
    }).as("milk");

    cy.visit("/shopping");
    cy.contains("label", "Bread").click();
    cy.wait("@bread");
    cy.contains("li", "Bread").should("contain", "In your cart");
    cy.get('input[aria-label="Take Bread out of your cart"]').should("be.checked");

    cy.contains("label", "Milk").click();
    cy.wait("@milk");
    cy.contains("[role=alert]", "It's in someone else's cart now, so only they can change it.");
    cy.contains("li", "Milk").should("contain", "In Bruno Díaz's cart");
    cy.get('input[aria-label="Put Milk in your cart"]').should("not.be.checked").and("be.disabled");
  });

  it("edits an item someone changed meanwhile, saving the person's version once they've seen theirs", () => {
    let items: ShoppingItemView[] = [milk];
    const edits: unknown[] = [];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: null }));
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
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: null }));
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

  it("finishes shopping without an expense, keeping what wasn't found, and undoes it from the toast", () => {
    const inCart = (item: ShoppingItemView) => ({ ...item, cartOwner: anaRef });
    let items: ShoppingItemView[] = [inCart(bread), milk];
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: null }));
    cy.intercept("POST", "/api/household/shopping/finish", (req) => {
      expect(req.body).to.deep.equal({ itemIds: ["item_bread"], expense: null });
      items = [milk];
      req.reply({ expense: null });
    }).as("finish");
    cy.intercept("POST", "/api/household/shopping/finish/undo", (req) => {
      expect(req.body).to.deep.equal({ itemIds: ["item_bread"] });
      items = [inCart(bread), milk];
      req.reply({ items: [inCart(bread)] });
    }).as("undo");

    cy.visit("/");
    cy.contains("section", "Shopping").within(() => {
      cy.contains("2 things to buy");
      cy.contains("You still have 1 in your cart");
    });
    cy.get('nav[aria-label="Main"]').contains("a", "Shopping").click();
    cy.findHeading("Shopping");

    // The bar sits above the tab bar, clear of it.
    cy.contains("p", "1 in your cart")
      .parent()
      .then(($bar) => {
        cy.get('nav[aria-label="Main"]').should(($nav) => {
          expect($bar[0]?.getBoundingClientRect().bottom).to.be.at.most(
            ($nav[0]?.getBoundingClientRect().top ?? Number.NaN) - 8,
          );
        });
      });
    cy.contains("p", "1 in your cart").parent().contains("button", "Finish shopping").click();
    cy.contains("[role=dialog]", "Done shopping?").within(() => {
      cy.contains("The 1 thing in your cart leaves the list. What you didn't find stays on it.");
      cy.contains("button", "Cancel").should("have.focus");
      cy.contains("button", "Finish without an expense").click();
    });

    cy.wait("@finish");
    cy.get("main li").should("have.length", 1).first().should("contain", "Milk");
    cy.contains("button", "Finish shopping").should("not.exist");
    cy.get('[role=region][aria-label="Notifications"]')
      .contains("[role=alertdialog]", "Done: 1 thing off the list")
      .contains("button", "Undo")
      .click();

    cy.wait("@undo");
    cy.contains("[role=status]", "1 thing is back in your cart");
    cy.get("main li").should("have.length", 2).first().should("contain", "Bread").and("contain", "In your cart");
    cy.contains("p", "1 in your cart").parent().contains("button", "Finish shopping");
  });

  it("adds, marks and finishes noting what was paid, then shows what was bought on the expense", () => {
    let items: ShoppingItemView[] = [bread];
    let expense: ExpenseView | null = null;
    const inCart = (item: ShoppingItemView) => ({ ...item, cartOwner: anaRef });
    cy.intercept("GET", "/api/household/shopping", (req) => req.reply({ items, lastCategoryId: "cat_groceries" }));
    cy.intercept("POST", "/api/household/shopping/items", (req) => {
      items = [bread, milk];
      req.reply({ statusCode: 201, body: { item: milk } });
    });
    cy.intercept("PUT", "/api/household/shopping/items/*/cart", (req) => {
      const id = decodeURIComponent(req.url.split("/").at(-2) ?? "");
      items = items.map((item) => (item.id === id ? inCart(item) : item));
      req.reply({ item: items.find((item) => item.id === id) });
    });
    cy.intercept("POST", "/api/household/shopping/finish", (req) => {
      expect(req.body).to.deep.equal({
        itemIds: ["item_bread", "item_milk"],
        expense: {
          description: "Bread and Milk",
          amountCents: 2400,
          currency: "EUR",
          paidById: ana.id,
          date: req.body.expense.date,
          categoryId: "cat_groceries",
          split: {
            method: "WEIGHTS",
            previewShares: [
              { userId: ana.id, amountCents: 1200 },
              { userId: "user_bruno", amountCents: 1200 },
            ],
          },
        },
      });
      items = [];
      expense = {
        id: "expense_shop",
        description: "Bread and Milk",
        amountCents: 2400,
        date: req.body.expense.date,
        paidBy: anaRef,
        split: {
          method: "WEIGHTS",
          shares: [
            { person: anaRef, amountCents: 1200 },
            { person: brunoRef, amountCents: 1200 },
          ],
        },
        category: { id: "cat_groceries", name: "Groceries", emoji: "🛒" },
        boughtItems: [
          { name: "Bread", note: null },
          { name: "Milk", note: "lactose-free" },
        ],
        createdBy: anaRef,
        createdAt: "2026-11-18T11:00:00.000Z",
        editedBy: null,
        editedAt: null,
        version: 1,
      };
      req.reply({ statusCode: 201, body: { expense } });
    }).as("finish");
    cy.intercept("GET", "/api/household/expenses/expense_shop", (req) => req.reply({ expense }));

    cy.visit("/shopping");
    cy.contains("label", "What's needed?").click();
    cy.focused().type("Milk");
    cy.contains("label", "Note (optional)").click();
    cy.focused().type("lactose-free{enter}");
    cy.get("main li").should("have.length", 2);
    cy.get('input[aria-label="Put Bread in your cart"]').check();
    cy.get('input[aria-label="Put Milk in your cart"]').check();

    cy.contains("p", "2 in your cart").parent().contains("button", "Finish shopping").click();
    cy.contains("[role=dialog]", "Done shopping?").within(() => {
      cy.contains("button", "Note what I paid").click();
    });

    cy.findHeading("Add an expense");
    cy.contains("label", "What was it?").next("input").should("have.value", "Bread and Milk");
    cy.contains("label", "Category").parent().find("select").should("have.value", "cat_groceries");
    cy.contains("section", "What you bought").within(() => {
      cy.get("li").should("have.length", 2);
      cy.contains("li", "Milk").should("contain", "lactose-free");
    });
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("24");
    cy.contains("button", "Save expense").click();

    cy.wait("@finish");
    cy.findHeading("Bread and Milk");
    cy.contains("[role=status]", "Expense saved.");
    cy.contains("section", "What was bought").within(() => {
      cy.get("li").should("have.length", 2);
      cy.contains("li", "Milk").should("contain", "lactose-free");
    });
  });
});
