import { stubSignedIn, visitIn } from "../support/screens";

/** The main navigation: a tab bar in thumb reach on phones, in the header from 48rem up. */
function rectOf($element: JQuery<HTMLElement>): DOMRect {
  const element = $element.get(0);
  if (!element) throw new Error("Nothing to measure");
  return element.getBoundingClientRect();
}

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

  it("never hides the end of a page behind the tab bar", () => {
    cy.viewport(375, 667);
    visitIn("/expenses", { locale: "es" });
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

  it("sits in the header next to the brand on a wide screen", () => {
    cy.viewport(1280, 800);
    visitIn("/", { locale: "es" });
    cy.get("header").then(($header) => {
      mainNav().should(($nav) => {
        expect(rectOf($nav).bottom, "inside the header").to.be.at.most(rectOf($header).bottom);
      });
    });
    mainNav().contains("a", "Gastos").click();
    cy.location("pathname").should("equal", "/expenses");
  });
});
