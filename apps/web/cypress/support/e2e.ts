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
  // The startup polls the health check before restoring the session, so the server is "awake" by default.
  cy.intercept("GET", "/api/health", { statusCode: 200, body: { status: "ok" } }).as("health");
  cy.intercept("POST", "/api/auth/refresh", { statusCode: 401, body: { error: { code: "auth.session.missing" } } }).as(
    "refresh",
  );
  cy.intercept("POST", "/api/auth/logout", { statusCode: 204 }).as("logout");
  // Signed-in people start without a household unless a flow says otherwise.
  cy.intercept("GET", "/api/household", { body: { household: null, removedFrom: null } }).as("household");
  cy.intercept("GET", "/api/household/categories", { body: { categories: starterCategories() } }).as("categories");
  // Everyone square, so pages that show a balance sentence work without setting balances up.
  cy.intercept("GET", "/api/household/balances", { body: { balances: [], suggestions: [], myBalanceCents: 0 } });
  // Nothing bought yet, so typing a shopping item suggests nothing.
  cy.intercept("GET", "/api/household/shopping/suggestions*", { body: { suggestions: [] } });
  // The live connection reaches a stub Socket.io server, which lets it in unless a flow says otherwise.
  cy.task("socket:reset");
});

afterEach(() => {
  // The page stays open after a test; closing its connection keeps it from reconnecting later.
  cy.task("socket:reset");
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

/** What the browser says the person speaks (`navigator.languages`), which suggests a new household's currency. */
export function browserLanguages(win: Window, ...languages: string[]) {
  Object.defineProperty(win.navigator, "languages", { get: () => languages });
}

function setVisibility(doc: Document, state: DocumentVisibilityState) {
  Object.defineProperty(doc, "visibilityState", { value: state, configurable: true });
  doc.dispatchEvent(new Event("visibilitychange"));
}

/**
 * What the browser says when the person switches tab, locks the phone or comes back. Hogar is live
 * only while on screen: hidden, it closes its live connection; shown again, it reconnects and
 * re-reads what it missed.
 */
export function setPageVisibility(state: DocumentVisibilityState) {
  cy.document().then((doc) => setVisibility(doc, state));
  // Nobody comes back within milliseconds: a page shown again before it has even closed its
  // connection never notices it was away.
  if (state === "hidden") cy.task("socket:disconnection");
}

/**
 * For `cy.visit`'s `onBeforeLoad`: the page opens in a background tab, so it connects only once the
 * test shows it, after its first reads are in. Connecting then re-reads each query exactly once,
 * which a test can count; connecting while the page loads may re-read nothing, because a query still
 * on its first read isn't read again.
 */
export function openInBackground(win: Window) {
  setVisibility(win.document, "hidden");
}
