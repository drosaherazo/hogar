import type { AuthResponse, AuthUser, CategoryView } from "@hogar/shared";

export const ana: AuthUser = {
  id: "user_ana",
  email: "ana@example.com",
  name: "Ana García",
  avatarUrl: null,
  locale: "en",
};

export const session = (user: AuthUser = ana): AuthResponse => ({ accessToken: "e2e-access-token", user });

/** A category that follows the household's split, as `GET /api/household/categories` returns it. */
export function categoryView(overrides: Partial<CategoryView> & Pick<CategoryView, "id" | "name">): CategoryView {
  return {
    emoji: null,
    position: 1,
    ownSplit: false,
    weights: null,
    needsReview: false,
    expenseCount: 0,
    version: 1,
    ...overrides,
  };
}

/** The starter set in English, which every new household gets. */
export const starterCategories = (): CategoryView[] => [
  categoryView({ id: "cat_rent", name: "Rent", emoji: "🏠", position: 1 }),
  categoryView({ id: "cat_groceries", name: "Groceries", emoji: "🛒", position: 2 }),
  categoryView({ id: "cat_utilities", name: "Utilities", emoji: "💡", position: 3 }),
  categoryView({ id: "cat_leisure", name: "Leisure", emoji: "🎉", position: 4 }),
  categoryView({ id: "cat_other", name: "Other", emoji: "📦", position: 5 }),
];

beforeEach(() => {
  // The real API isn't running in E2E: every flow stubs the endpoints it needs.
  // Served as text: Cypress would try to parse a .js fixture as an object.
  cy.intercept("GET", "https://accounts.google.com/gsi/client", {
    fixture: "fake-google.txt",
    headers: { "content-type": "application/javascript" },
  }).as("gsi");
  cy.intercept("POST", "/api/auth/refresh", { statusCode: 401, body: { error: { code: "auth.session.missing" } } }).as(
    "refresh",
  );
  cy.intercept("POST", "/api/auth/logout", { statusCode: 204 }).as("logout");
  // Signed-in people start without a household unless a flow says otherwise.
  cy.intercept("GET", "/api/household", { body: { household: null, removedFrom: null } }).as("household");
  cy.intercept("GET", "/api/household/categories", { body: { categories: starterCategories() } }).as("categories");
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Cypress registers custom commands on this namespace.
  namespace Cypress {
    interface Chainable {
      /** The page's main heading, matched by its exact text. */
      findHeading(text: string): Chainable<JQuery<HTMLHeadingElement>>;
    }
  }
}

Cypress.Commands.add("findHeading", (text: string) => cy.contains("h1", new RegExp(`^${text}$`)));
