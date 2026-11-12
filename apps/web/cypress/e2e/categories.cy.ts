import type {
  ActivityItem,
  ActivityPage,
  BalancesView,
  CategoryRef,
  CategoryView,
  ExpenseView,
  HouseholdView,
  MemberView,
  PersonRef,
} from "@hogar/shared";
import { ana, categoryView, session, starterCategories } from "../support/e2e";

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

const household = (overrides: Partial<HouseholdView> = {}): HouseholdView => ({
  id: "household_1",
  name: "Casa Ana",
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [anaMember, brunoMember],
  splitNeedsReview: false,
  ...overrides,
});

const anaRef: PersonRef = { userId: ana.id, name: ana.name, avatarUrl: null, former: false };
const brunoRef: PersonRef = { userId: "user_bruno", name: "Bruno Díaz", avatarUrl: null, former: false };

const refOf = (category: CategoryView): CategoryRef => ({
  id: category.id,
  name: category.name,
  emoji: category.emoji,
});

/** Rent with its own split, 1 / 1. */
const rentOwn = (overrides: Partial<CategoryView> = {}) =>
  categoryView({
    id: "cat_rent",
    name: "Rent",
    emoji: "🏠",
    ownSplit: true,
    version: 2,
    weights: [
      { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 5000 },
      { membershipId: "m_bruno", userId: "user_bruno", weight: 1, shareBps: 5000 },
    ],
    ...overrides,
  });

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
    category: null,
    ...overrides,
  };
}

const item = (view: ExpenseView): ActivityItem => ({
  kind: "expense",
  id: view.id,
  description: view.description,
  amountCents: view.amountCents,
  date: view.date,
  paidBy: view.paidBy,
  viewerPart: { kind: "lent", amountCents: 0 },
  category: view.category,
  deleted: null,
});

const page = (...items: ActivityItem[]): ActivityPage => ({ items, nextCursor: null });

const square: BalancesView = {
  balances: [
    { person: anaRef, balanceCents: 0 },
    { person: brunoRef, balanceCents: 0 },
  ],
  suggestions: [],
  myBalanceCents: 0,
};

// --- Flows ---------------------------------------------------------------------

describe("Expense categories", () => {
  beforeEach(() => {
    cy.intercept("POST", "/api/auth/refresh", session()).as("refresh");
    cy.intercept("GET", "/api/household", { body: { household: household() } }).as("household");
    cy.intercept("GET", "/api/household/balances", { body: square });
    cy.intercept("GET", "/api/household/invitations", { body: { invitations: [] } });
  });

  it("labels an expense with a category, and leaves another without one", () => {
    const groceries = starterCategories()[1] as CategoryView;
    const saved: ExpenseView[] = [];
    cy.intercept("GET", "/api/household/activity*", (req) => req.reply(page(...saved.map(item).reverse())));
    cy.intercept("POST", "/api/household/expenses", (req) => {
      const body = req.body as { description: string; categoryId: string | null };
      const view = expense({
        id: `expense_${saved.length + 1}`,
        description: body.description,
        category: body.categoryId ? refOf(groceries) : null,
      });
      saved.push(view);
      req.reply({ statusCode: 201, body: { expense: view } });
    }).as("create");
    cy.intercept("GET", "/api/household/expenses/*", (req) => {
      const id = req.url.split("/").pop();
      req.reply({ body: { expense: saved.find((entry) => entry.id === id) } });
    });

    cy.visit("/expenses/new");
    cy.contains("label", "What was it?").click();
    cy.focused().type("Weekly shop");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("42.80");
    cy.contains("label", "Category").click();
    cy.focused().select("🛒 Groceries");
    cy.contains("button", "Save expense").click();
    cy.wait("@create").its("request.body").should("deep.include", { categoryId: "cat_groceries" });
    cy.findHeading("Weekly shop");
    cy.contains("article", "Groceries");

    cy.visit("/expenses/new");
    cy.contains("label", "What was it?").click();
    cy.focused().type("Coffee");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("2.50");
    cy.contains("button", "Save expense").click();
    cy.wait("@create").its("request.body").should("deep.include", { categoryId: null });

    cy.visit("/expenses");
    cy.contains("a", "Weekly shop").should("contain", "Groceries");
    cy.contains("a", "Coffee").should("not.contain", "Groceries");
  });

  it("lets an admin add, rename and delete categories, and shows members a read-only list", () => {
    let categories = starterCategories().map((entry) =>
      entry.id === "cat_leisure" ? { ...entry, expenseCount: 12 } : entry,
    );
    cy.intercept("GET", "/api/household/categories", (req) => req.reply({ body: { categories } }));
    cy.intercept("POST", "/api/household/categories", (req) => {
      const created = categoryView({ id: "cat_dog", name: "Dog", emoji: "🐶", position: 6 });
      expect(req.body).to.deep.equal({ name: "Dog", emoji: "🐶" });
      categories = [...categories, created];
      req.reply({ statusCode: 201, body: { category: created } });
    }).as("add");
    cy.intercept("PATCH", "/api/household/categories/cat_utilities", (req) => {
      expect(req.body).to.deep.equal({ name: "Bills", emoji: "💡", version: 1 });
      categories = categories.map((entry) =>
        entry.id === "cat_utilities" ? { ...entry, name: "Bills", version: 2 } : entry,
      );
      req.reply({ body: { category: categories.find((entry) => entry.id === "cat_utilities") } });
    }).as("rename");
    cy.intercept("DELETE", "/api/household/categories/cat_leisure*", (req) => {
      expect(req.url).to.contain("version=1");
      categories = categories.filter((entry) => entry.id !== "cat_leisure");
      req.reply({ statusCode: 204 });
    }).as("delete");

    cy.visit("/household/settings");
    cy.contains("section", "Categories").within(() => {
      cy.contains("button", "Add category").click();
    });
    cy.get("[role=dialog]").within(() => {
      cy.contains("label", "Name").click();
      cy.focused().type("Dog");
      cy.contains("label", "Emoji (optional)").click();
      cy.focused().type("🐶");
      cy.contains("button", "Save category").click();
    });
    cy.wait("@add");
    cy.contains("[role=status]", "Category saved.");

    cy.get(`button[aria-label="Edit Utilities"]`).click();
    cy.get("[role=dialog]").within(() => {
      cy.contains("label", "Name").click();
      cy.focused().clear().type("Bills");
      cy.contains("button", "Save category").click();
    });
    cy.wait("@rename");
    cy.contains("section", "Categories").should("contain", "Bills");

    cy.get(`button[aria-label="Edit Leisure"]`).click();
    cy.get("[role=dialog]").contains("button", "Delete category").click();
    cy.contains("[role=dialog]", "Delete Leisure?").within(() => {
      cy.contains("12 expenses will be left without a category. Nobody's share will change.");
      cy.focused().should("have.text", "Cancel");
      cy.contains("button", "Delete category").click();
    });
    cy.wait("@delete");
    cy.contains("[role=status]", "Category deleted.");
    cy.contains("section", "Categories").should("not.contain", "Leisure");

    // Bruno, a member, sees the same list without any way to change it.
    cy.intercept("GET", "/api/household", { body: { household: household({ myRole: "MEMBER" }) } });
    cy.visit("/household/settings");
    cy.contains("section", "Categories").within(() => {
      cy.contains("Only admins can change categories.");
      cy.contains("Bills");
      cy.get("button").should("not.exist");
    });
  });

  it("gives a category its own split, and new expenses in it use it", () => {
    let categories = starterCategories();
    cy.intercept("GET", "/api/household/categories", (req) => req.reply({ body: { categories } }));
    cy.intercept("PUT", "/api/household/categories/cat_rent/split", (req) => {
      expect(req.body).to.deep.equal({
        version: 1,
        ownSplit: true,
        weights: [
          { membershipId: "m_ana", weight: 1 },
          { membershipId: "m_bruno", weight: 1 },
        ],
      });
      categories = categories.map((entry) => (entry.id === "cat_rent" ? rentOwn() : entry));
      req.reply({ body: { category: rentOwn() } });
    }).as("split");

    cy.visit("/household/settings");
    cy.get(`button[aria-label="Edit Rent"]`).click();
    cy.get("[role=dialog]").within(() => {
      cy.contains("The household's split: Ana García 75% and Bruno Díaz 25%");
      cy.contains("label", "Use its own split").click();
      cy.contains("label", "Ana García").click();
      cy.focused().should("have.value", "3").clear().type("1");
      cy.contains("50% of shared costs");
      cy.contains("button", "Save category").click();
    });
    cy.wait("@split");
    cy.contains("li", "Rent").should("contain", "Own split: Ana García 50% and Bruno Díaz 50%");

    cy.visit("/expenses/new");
    cy.contains("label", "Amount (€)").click();
    cy.focused().type("900");
    cy.contains("label", "Category").click();
    cy.focused().select("🏠 Rent");
    cy.contains("label", "Rent's split");
    cy.contains("li", "Ana García").should("contain", "€450.00");
    cy.contains("li", "Bruno Díaz").should("contain", "€450.00");
  });

  it("asks before moving an expense to a category that changes the shares, and handles a split changed meanwhile", () => {
    const leisure = categoryView({ id: "cat_leisure", name: "Leisure", emoji: "🎉", position: 2 });
    let rent = rentOwn();
    cy.intercept("GET", "/api/household/categories", (req) => req.reply({ body: { categories: [rent, leisure] } }));
    const mistake = expense({
      description: "Rent",
      amountCents: 90000,
      category: refOf(leisure),
      split: {
        method: "WEIGHTS",
        shares: [
          { person: anaRef, amountCents: 67500 },
          { person: brunoRef, amountCents: 22500 },
        ],
      },
    });
    cy.intercept("GET", "/api/household/expenses/expense_1", { body: { expense: mistake } });
    const bodies: unknown[] = [];
    cy.intercept("PUT", "/api/household/expenses/expense_1", (req) => {
      bodies.push(req.body);
      if (bodies.length === 1) {
        // Meanwhile, Ana changed Rent to 2 / 1: the shares Bruno saw are out of date.
        rent = rentOwn({
          version: 3,
          weights: [
            { membershipId: "m_ana", userId: ana.id, weight: 2, shareBps: 6667 },
            { membershipId: "m_bruno", userId: "user_bruno", weight: 1, shareBps: 3333 },
          ],
        });
        req.reply({ statusCode: 409, body: { error: { code: "expense.split.changed" } } });
        return;
      }
      req.reply({ body: { expense: { ...mistake, category: refOf(rent), version: 2 } } });
    }).as("save");

    cy.visit("/expenses/expense_1/edit");
    cy.contains("label", "Category").click();
    cy.focused().select("🏠 Rent");
    cy.contains("button", "Save expense").click();

    cy.contains("[role=dialog]", "The shares would change").within(() => {
      cy.contains("Ana García: €675.00 → €450.00");
      cy.contains("Bruno Díaz: €225.00 → €450.00");
      cy.contains("label", "Apply Rent's split").find("input").should("be.checked");
      cy.contains("button", "Save expense").click();
    });
    cy.wait("@save").then(() => {
      expect(bodies[0]).to.deep.include({
        categoryId: "cat_rent",
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 45000 },
            { userId: "user_bruno", amountCents: 45000 },
          ],
        },
      });
    });

    // The dialog stays open with the message and the new figures; saving again sends them.
    cy.contains("[role=dialog]", "The shares would change").within(() => {
      cy.contains("The split changed while you were editing.");
      cy.contains("Ana García: €675.00 → €600.00");
      cy.contains("button", "Save expense").click();
    });
    cy.wait("@save").then(() => {
      expect(bodies[1]).to.deep.include({
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 60000 },
            { userId: "user_bruno", amountCents: 30000 },
          ],
        },
      });
    });
    cy.contains("[role=status]", "Expense saved.");
  });

  it("filters the history by category, keeps the filter in the URL and clears it", () => {
    const dog = categoryView({ id: "cat_dog", name: "Dog", emoji: "🐶", position: 6 });
    cy.intercept("GET", "/api/household/categories", { body: { categories: [...starterCategories(), dog] } });
    const vet = expense({ id: "e_vet", description: "Vet", category: refOf(dog) });
    const coffee = expense({ id: "e_coffee", description: "Coffee" });
    cy.intercept("GET", "/api/household/activity*", (req) => {
      const category = new URL(req.url).searchParams.get("category");
      req.reply(category === "cat_dog" ? page(item(vet)) : category === null ? page(item(vet), item(coffee)) : page());
    });

    cy.visit("/expenses");
    cy.contains("a", "Coffee");
    cy.contains("label", "Category").click();
    cy.focused().select("🐶 Dog");
    cy.contains("Showing: Dog");
    cy.location("search").should("eq", "?category=cat_dog");
    cy.contains("a", "Vet");
    cy.contains("a", "Coffee").should("not.exist");

    cy.reload();
    cy.contains("Showing: Dog");
    cy.contains("a", "Coffee").should("not.exist");

    cy.contains("button", "Show everything").click();
    cy.location("search").should("eq", "");
    cy.contains("a", "Coffee");
  });
});
