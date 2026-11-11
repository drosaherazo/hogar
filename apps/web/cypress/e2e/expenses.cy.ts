import type {
  ActivityItem,
  ActivityPage,
  BalancesView,
  ExpenseView,
  HouseholdView,
  MemberView,
  PersonRef,
} from "@hogar/shared";
import { ana, session } from "../support/e2e";

// --- Stub data -----------------------------------------------------------------

const anaMember: MemberView = {
  id: "m_ana",
  userId: ana.id,
  name: ana.name,
  avatarUrl: null,
  role: "ADMIN",
  weight: 3,
  shareBps: 7500,
  joinedAt: "2026-11-10T10:00:00.000Z",
};
const brunoMember: MemberView = {
  ...anaMember,
  id: "m_bruno",
  userId: "user_bruno",
  name: "Bruno Díaz",
  role: "MEMBER",
  weight: 1,
  shareBps: 2500,
  joinedAt: "2026-11-10T10:00:01.000Z",
};

const household: HouseholdView = {
  id: "household_1",
  name: "Casa Ana",
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [anaMember, brunoMember],
  splitNeedsReview: false,
};

const anaRef: PersonRef = { userId: ana.id, name: ana.name, avatarUrl: null, former: false };
const brunoRef: PersonRef = { userId: "user_bruno", name: "Bruno Díaz", avatarUrl: null, former: false };

function expense(overrides: Partial<ExpenseView> = {}): ExpenseView {
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

function expenseItem(view: ExpenseView, viewerPart: { kind: "owes" | "lent" | "none"; amountCents: number }) {
  const item: ActivityItem = {
    kind: "expense",
    id: view.id,
    description: view.description,
    amountCents: view.amountCents,
    date: view.date,
    paidBy: view.paidBy,
    viewerPart,
    deleted: null,
  };
  return item;
}

const page = (...items: ActivityItem[]): ActivityPage => ({ items, nextCursor: null });

const square: BalancesView = {
  balances: [
    { person: anaRef, balanceCents: 0 },
    { person: brunoRef, balanceCents: 0 },
  ],
  suggestions: [],
  myBalanceCents: 0,
};

/** Ana is owed `cents` by Bruno. */
const anaIsOwed = (cents: number): BalancesView => ({
  balances: [
    { person: anaRef, balanceCents: cents },
    { person: brunoRef, balanceCents: -cents },
  ],
  suggestions: [{ from: brunoRef, to: anaRef, amountCents: cents }],
  myBalanceCents: cents,
});

/** Brings the tab back into focus, which refetches what the page shows (no real time yet). */
function comeBackToTheTab() {
  cy.window().then((win) => {
    win.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
  });
}

// --- Flows ---------------------------------------------------------------------

describe("Expenses", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/auth/refresh", session()).as("refresh");
    cy.intercept("GET", "/api/household", { body: { household } }).as("household");
  });

  it("adds an expense with the household's split and shows where Ana stands", () => {
    let saved = false;
    cy.intercept("GET", "/api/household/balances", (req) => req.reply(saved ? anaIsOwed(1070) : square));
    cy.intercept("GET", "/api/household/activity*", (req) =>
      req.reply(saved ? page(expenseItem(expense(), { kind: "lent", amountCents: 1070 })) : page()),
    );
    cy.intercept("POST", "/api/household/expenses", (req) => {
      expect(req.body).to.deep.include({ description: "Groceries", amountCents: 4280, split: { method: "WEIGHTS" } });
      saved = true;
      req.reply({ statusCode: 201, body: { expense: expense() } });
    }).as("create");
    cy.intercept("GET", "/api/household/expenses/expense_1", { body: { expense: expense() } });

    cy.visit("/");
    cy.contains("You're all square");
    cy.contains("a", "Add expense").click();
    cy.findHeading("Add an expense");
    cy.contains("label", "What was it?").click();
    cy.focused().type("Groceries");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("42.80");
    cy.contains("li", "Ana García").should("contain", "€32.10");
    cy.contains("li", "Bruno Díaz").should("contain", "€10.70");
    cy.contains("button", "Save expense").click();

    cy.wait("@create");
    cy.contains("[role=status]", "Expense saved.");
    cy.findHeading("Groceries");
    cy.contains("a", "Home").click();
    cy.contains("You're owed €10.70 in total");
  });

  it("splits equally among some people, and with exact amounts", () => {
    const bodies: unknown[] = [];
    cy.intercept("GET", "/api/household/balances", square);
    cy.intercept("POST", "/api/household/expenses", (req) => {
      bodies.push(req.body);
      req.reply({ statusCode: 201, body: { expense: expense() } });
    }).as("create");
    cy.intercept("GET", "/api/household/expenses/expense_1", { body: { expense: expense() } });

    cy.visit("/expenses/new");
    cy.contains("label", "What was it?").click();
    cy.focused().type("Dinner");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("10");
    cy.contains("label", "Equally between…").click();
    cy.contains("fieldset", "Who shares it?").within(() => {
      cy.contains("label", "Bruno Díaz").click();
      cy.contains("label", "Ana García").should("contain", "€10.00");
    });
    cy.contains("button", "Save expense").click();
    cy.wait("@create").then(() => {
      expect(bodies[0]).to.deep.include({ split: { method: "EQUAL", userIds: [ana.id] } });
    });

    cy.visit("/expenses/new");
    cy.contains("label", "What was it?").click();
    cy.focused().type("Electricity bill");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("50");
    cy.contains("label", "Exact amounts").click();
    cy.contains("fieldset", "How much each person pays").within(() => {
      cy.contains("label", "Ana García").click();
      cy.focused().type("30");
      cy.contains("label", "Bruno Díaz").click();
      cy.focused().type("15");
    });
    cy.contains("€5.00 left to assign");
    cy.contains("button", "Save expense").should("be.disabled");
    cy.contains("fieldset", "How much each person pays").within(() => {
      cy.contains("label", "Bruno Díaz").click();
      cy.focused().clear().type("20");
    });
    cy.contains("button", "Save expense").should("be.enabled").click();
    cy.wait("@create").then(() => {
      expect(bodies[1]).to.deep.include({
        split: {
          method: "EXACT",
          shares: [
            { userId: ana.id, amountCents: 3000 },
            { userId: "user_bruno", amountCents: 2000 },
          ],
        },
      });
    });
  });

  it("settles up from a suggested payment", () => {
    let settled = false;
    cy.intercept("GET", "/api/household/balances", (req) => req.reply(settled ? square : anaIsOwed(1070)));
    cy.intercept("POST", "/api/household/settlements", (req) => {
      expect(req.body).to.deep.include({ fromUserId: "user_bruno", toUserId: ana.id, amountCents: 1070 });
      settled = true;
      req.reply({
        statusCode: 201,
        body: {
          settlement: {
            id: "settlement_1",
            from: brunoRef,
            to: anaRef,
            amountCents: 1070,
            date: "2026-11-11",
            createdBy: anaRef,
            createdAt: "2026-11-11T10:00:00.000Z",
            editedBy: null,
            editedAt: null,
            version: 1,
          },
        },
      });
    }).as("settle");

    cy.visit("/balances");
    cy.contains("li", "Bruno Díaz owes you €10.70").within(() => {
      cy.contains("button", "Record this payment").click();
    });
    cy.get("[role=dialog]").within(() => {
      cy.contains("Right now, Bruno Díaz owes Ana García €10.70.");
      cy.contains("button", "Record payment").click();
    });
    cy.wait("@settle");
    cy.contains("[role=status]", "Payment recorded.");
    cy.contains("All square! Nobody owes anything.");
  });

  it("shows another person's expense after coming back to the tab", () => {
    let brunoAdded = false;
    const bread = expense({ id: "expense_2", description: "Bread", amountCents: 400, paidBy: brunoRef });
    cy.intercept("GET", "/api/household/balances", (req) => req.reply(brunoAdded ? anaIsOwed(670) : anaIsOwed(1070)));
    cy.intercept("GET", "/api/household/activity*", (req) =>
      req.reply(
        brunoAdded
          ? page(
              expenseItem(bread, { kind: "owes", amountCents: 300 }),
              expenseItem(expense(), { kind: "lent", amountCents: 1070 }),
            )
          : page(expenseItem(expense(), { kind: "lent", amountCents: 1070 })),
      ),
    );

    cy.visit("/expenses");
    cy.contains("You're owed €10.70 in total");
    cy.contains("a", "Groceries");

    // Bruno records an expense from his phone (simulated: the API now answers with it).
    cy.then(() => {
      brunoAdded = true;
    });
    comeBackToTheTab();
    cy.contains("a", "Bread").should("contain", "Bruno Díaz paid").and("contain", "You owe €3.00");
    cy.contains("You're owed €6.70 in total");
  });

  it("explains an edit conflict and shows the latest version", () => {
    let changed = false;
    cy.intercept("GET", "/api/household/balances", square);
    cy.intercept("GET", "/api/household/expenses/expense_1", (req) =>
      req.reply({ expense: changed ? expense({ description: "Bruno's shop", version: 2 }) : expense() }),
    );
    cy.intercept("PUT", "/api/household/expenses/expense_1", (req) => {
      changed = true;
      req.reply({ statusCode: 409, body: { error: { code: "expense.changed" } } });
    }).as("update");

    cy.visit("/expenses/expense_1/edit");
    cy.findHeading("Edit expense");
    cy.contains("label", "What was it?").click();
    cy.focused().clear().type("Ana's shop");
    cy.contains("button", "Save expense").click();
    cy.wait("@update");
    cy.contains("[role=alert]", "Someone changed this expense while you were editing it. Here's the latest version.");
    cy.get('input[value="Bruno\'s shop"]').should("exist");
  });

  it("deletes an expense after confirming, leaving a line in the history", () => {
    let deleted = false;
    cy.intercept("GET", "/api/household/balances", square);
    cy.intercept("GET", "/api/household/expenses/expense_1", { body: { expense: expense() } });
    cy.intercept("DELETE", "/api/household/expenses/expense_1*", (req) => {
      expect(req.url).to.contain("version=1");
      deleted = true;
      req.reply({ statusCode: 204 });
    }).as("delete");
    cy.intercept("GET", "/api/household/activity*", (req) =>
      req.reply(
        deleted
          ? page({
              ...expenseItem(expense(), { kind: "none", amountCents: 0 }),
              deleted: { by: anaRef, at: "2026-11-11T10:00:00.000Z" },
            })
          : page(expenseItem(expense(), { kind: "lent", amountCents: 1070 })),
      ),
    );

    cy.visit("/expenses/expense_1");
    cy.contains("button", "Delete").click();
    cy.get("[role=dialog]").within(() => {
      cy.contains('Delete "Groceries" (€42.80)?');
      cy.contains("button", "Delete expense").click();
    });
    cy.wait("@delete");
    cy.contains("[role=status]", "Expense deleted.");
    cy.contains('Ana García deleted "Groceries" (€42.80)');
    cy.contains("a", "Groceries").should("not.exist");
  });
});
