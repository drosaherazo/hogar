import type { AuthResponse, AuthUser } from "@hogar/shared";

export const ana: AuthUser = {
  id: "user_ana",
  email: "ana@example.com",
  name: "Ana García",
  avatarUrl: null,
  locale: "en",
};

export const session = (user: AuthUser = ana): AuthResponse => ({ accessToken: "e2e-access-token", user });

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
