import { rectOf, stubSignedIn, visitIn } from "../support/screens";

/** The main navigation: a tab bar in thumb reach on phones, in the header from 48rem up. */

const mainNav = () => cy.get('nav[aria-label="Principal"]');

describe("Main navigation", () => {
  beforeEach(() => {
    stubSignedIn("es");
  });

  it("is a tab bar at the bottom of a phone, used to move between sections", () => {
    cy.viewport(375, 667);
    visitIn("/", { locale: "es" });
    mainNav().should(($nav) => {
      expect(rectOf($nav).bottom, "bottom edge").to.be.closeTo(667, 1);
      expect(rectOf($nav).width, "width").to.equal(375);
    });
    mainNav().contains("a", "Gastos").click();
    cy.location("pathname").should("equal", "/expenses");
    mainNav().contains("a", "Gastos").should("have.attr", "aria-current", "page");
  });

  for (const textZoom of [1, 2]) {
    it(`never hides the end of a page behind the tab bar (text at ${textZoom * 100} %)`, () => {
      cy.viewport(375, 667);
      visitIn("/expenses", { locale: "es", textZoom });
      cy.scrollTo("bottom");
      mainNav().then(($nav) => {
        const navTop = rectOf($nav).top;
        cy.get("main *").then(($content) => {
          const bottoms = [...$content]
            .map((element) => element.getBoundingClientRect())
            .filter((rect) => rect.height > 0);
          const end = Math.max(...bottoms.map((rect) => rect.bottom));
          expect(end, "end of the page").to.be.at.most(navTop);
        });
      });
    });
  }

  it("sits in the header next to the brand on a wide screen", () => {
    cy.viewport(1280, 800);
    visitIn("/", { locale: "es" });
    cy.get("header").then(($header) => {
      const brand = rectOf($header.children().first());
      const account = rectOf($header.find("button").last());
      mainNav().should(($nav) => {
        const nav = rectOf($nav);
        expect(nav.bottom, "inside the header").to.be.at.most(rectOf($header).bottom);
        expect(nav.left - brand.right, "gap after the brand").to.be.within(0, 48);
        expect(nav.right, "before the account menu").to.be.at.most(account.left);
      });
    });
    mainNav().contains("a", "Gastos").click();
    cy.location("pathname").should("equal", "/expenses");
  });
});
