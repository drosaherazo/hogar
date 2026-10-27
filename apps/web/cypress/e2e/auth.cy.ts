import { ana, session } from "../support/e2e";

describe("Signing in and out", () => {
  it("sends anonymous visitors to the login page", () => {
    cy.visit("/");
    cy.location("pathname").should("eq", "/login");
    cy.findHeading("Welcome to Hogar");
    cy.contains("We only use your name, email and photo from Google.");
  });

  it("signs in with Google, greets the person and signs them out", () => {
    cy.intercept("POST", "/api/auth/google", (req) => {
      expect(req.body).to.deep.equal({ credential: "fake-google-id-token" });
      req.reply(session());
    }).as("google");

    cy.visit("/login");
    cy.contains("button", "Continue with Google").click();
    cy.wait("@google");

    cy.location("pathname").should("eq", "/");
    cy.findHeading("Hi, Ana");
    cy.contains("You're not part of a household yet");

    cy.get(`button[aria-label="Account menu for ${ana.name}"]`).click();
    cy.contains("[role=menuitem]", "Sign out").click();
    cy.wait("@logout");
    cy.location("pathname").should("eq", "/login");
  });

  it("restores the session on reload", () => {
    cy.intercept("POST", "/api/auth/refresh", session()).as("refresh");
    cy.visit("/");
    cy.wait("@refresh");
    cy.findHeading("Hi, Ana");
  });

  it("explains a failed sign-in in Spanish", () => {
    cy.intercept("POST", "/api/auth/google", {
      statusCode: 401,
      body: { error: { code: "auth.google.email_not_verified" } },
    });
    cy.visit("/login");
    cy.contains("button", "Español").click();
    cy.findHeading("Te damos la bienvenida a Hogar");
    cy.contains("button", "Continue with Google").click();
    cy.get("[role=alert]").should("contain", "El email de tu cuenta de Google aún no está verificado.");
  });
});
