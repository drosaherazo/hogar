import { rectOf, stubSignedIn, visitIn } from "../support/screens";

/** On a big screen Hogar uses the width where it helps reading, and never spreads edge to edge. */

const householdCard = () => cy.contains("h2", "Piso compartido de la calle Mayor").closest("section");
const moneyCard = () => cy.contains("h2", "Gastos").closest("section");

describe("Desktop layout", () => {
  beforeEach(() => {
    stubSignedIn("es");
  });

  it("puts Home's household and money side by side on a wide screen", () => {
    cy.viewport(1280, 800);
    visitIn("/", { locale: "es" });
    householdCard().then(($household) => {
      moneyCard().should(($money) => {
        expect(rectOf($money).top, "same row").to.be.closeTo(rectOf($household).top, 1);
        expect(rectOf($money).left, "beside it").to.be.greaterThan(rectOf($household).right);
      });
    });
  });

  it("puts balances and the payments that settle them side by side on a wide screen", () => {
    cy.viewport(1280, 800);
    visitIn("/balances", { locale: "es" });
    cy.contains("h2", "El saldo de cada persona")
      .closest("section")
      .then(($everyone) => {
        cy.contains("h2", "Pagos para quedar todos al día")
          .closest("section")
          .should(($payments) => {
            expect(rectOf($payments).top, "same row").to.be.closeTo(rectOf($everyone).top, 1);
          });
      });
  });

  it("stacks them in reading order on a phone", () => {
    cy.viewport(375, 667);
    visitIn("/", { locale: "es" });
    householdCard().then(($household) => {
      moneyCard().should(($money) => {
        expect(rectOf($money).top, "below it").to.be.greaterThan(rectOf($household).bottom);
      });
    });
  });

  it("lines the header up with the page on a very wide screen, and keeps alerts a reading line long", () => {
    cy.viewport(1920, 1000);
    visitIn("/", { locale: "es" });
    cy.contains("h1", "Hola, Ana").then(($greeting) => {
      cy.get("header").should(($header) => {
        expect(rectOf($header.children().first()).left, "brand over the page").to.be.closeTo(rectOf($greeting).left, 1);
      });
    });
    cy.get("main").then(($main) => {
      const greeting = $main.find("h1").parent();
      // --size-content-md: 40rem, 640 px at the default text size.
      expect(rectOf(greeting).width, "text outside the columns").to.be.at.most(640);
    });
  });

  for (const path of ["/", "/expenses", "/household/settings"]) {
    it(`keeps ${path} and the header within the page's width on a very wide screen`, () => {
      cy.viewport(1920, 1000);
      visitIn(path, { locale: "es" });
      // --size-content-lg: 64rem, 1024 px at the default text size.
      cy.get("main").should(($main) => expect(rectOf($main).width).to.be.at.most(1024));
      cy.get("header").then(($header) => {
        const brand = rectOf($header.children().first());
        const account = rectOf($header.find("button").last());
        expect(account.right - brand.left, "header content").to.be.at.most(1024);
      });
    });
  }
});
