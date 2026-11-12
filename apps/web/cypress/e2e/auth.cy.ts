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

describe("Signing in with a code", () => {
  const lucia = { ...ana, id: "user_lucia", email: "lucia@example.com", name: "Brave Otter" };

  /** Stubs the code endpoints: sending always works, and only `code` signs Lucía in. */
  function stubCodeSignIn(code = "482913") {
    cy.intercept("POST", "/api/auth/email/code", (req) => {
      expect(req.body).to.deep.equal({ email: "lucia@example.com", locale: "en" });
      req.reply({ statusCode: 204 });
    }).as("sendCode");
    cy.intercept("POST", "/api/auth/email/sign-in", (req) => {
      const body = req.body as { email: string; code: string };
      expect(body.email).to.equal("lucia@example.com");
      req.reply(
        body.code === code
          ? { body: session(lucia) }
          : { statusCode: 401, body: { error: { code: "auth.code.wrong" } } },
      );
    }).as("signIn");
  }

  function askForCode() {
    cy.get("input[type=email]").type("Lucia@Example.com");
    cy.contains("button", "Email me a code").click();
    cy.wait("@sendCode");
    cy.contains("h2", "Check your email");
    cy.contains("We sent a 6-digit code to lucia@example.com. It works for 10 minutes.");
  }

  it("signs in with a code from the email, typed with a space", () => {
    stubCodeSignIn();
    cy.visit("/login");
    askForCode();
    cy.focused().should("have.attr", "autocomplete", "one-time-code").type("482 913");
    cy.contains("button", "Sign in").click();
    cy.wait("@signIn").its("request.body.code").should("eq", "482913");
    cy.location("pathname").should("eq", "/");
    cy.findHeading("Hi, Brave Otter");
  });

  it("explains a wrong code, then lets the right one in", () => {
    stubCodeSignIn();
    cy.visit("/login");
    askForCode();
    cy.focused().type("111111{enter}");
    cy.wait("@signIn");
    cy.contains("That code isn't right. Check the email and try again.");
    cy.focused().clear().type("482913{enter}");
    cy.wait("@signIn");
    cy.findHeading("Hi, Brave Otter");
  });

  it("returns to the invitation after signing in with a code", () => {
    stubCodeSignIn();
    cy.intercept("POST", "/api/invitations/lookup", {
      body: {
        householdName: "Casa Ana",
        inviterName: "Ana García",
        role: "MEMBER",
        expiresAt: "2026-11-11T22:00:00.000Z",
        viewer: "can_join",
      },
    });
    cy.visit("/invite#tok_join");
    cy.location("pathname").should("eq", "/login");
    askForCode();
    cy.focused().type("482913{enter}");
    cy.wait("@signIn");
    cy.location("pathname").should("eq", "/invite");
    cy.location("hash").should("eq", "#tok_join");
    cy.contains("Ana García invites you to join Casa Ana as a member.");
  });
});
