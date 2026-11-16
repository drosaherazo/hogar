import { stubSignedIn, visitIn } from "../support/screens";

/** "Add expense" in thumb reach on phones, as a floating button above the tab bar; in the page from 48rem. */
function rectOf($element: JQuery<HTMLElement>): DOMRect {
  const element = $element.get(0);
  if (!element) throw new Error("Nothing to measure");
  return element.getBoundingClientRect();
}

const addExpense = () => cy.contains("a", "Añadir gasto");

describe("Floating Add expense", () => {
  beforeEach(() => {
    stubSignedIn("es");
  });

  for (const path of ["/", "/expenses"]) {
    it(`floats above the tab bar at the trailing edge of a phone on ${path}, and opens the form`, () => {
      cy.viewport(375, 667);
      visitIn(path, { locale: "es" });
      cy.get('nav[aria-label="Principal"]').then(($nav) => {
        const navTop = rectOf($nav).top;
        addExpense().should(($link) => {
          const rect = rectOf($link);
          expect(getComputedStyle($link.get(0) as Element).position, "floating").to.equal("fixed");
          expect(rect.bottom, "above the tab bar").to.be.at.most(navTop - 8);
          expect(375 - rect.right, "trailing edge").to.be.within(8, 24);
          expect(rect.height, "touch size").to.be.at.least(44);
        });
      });
      cy.get("a").filter(':contains("Añadir gasto")').should("have.length", 1);
      addExpense().click();
      cy.location("pathname").should("equal", "/expenses/new");
    });
  }

  it("never covers the end of the page", () => {
    cy.viewport(375, 667);
    visitIn("/expenses", { locale: "es" });
    cy.scrollTo("bottom");
    addExpense().then(($link) => {
      const top = rectOf($link).top;
      cy.get("main *").then(($content) => {
        const rects = [...$content]
          .filter((element) => !$link.get(0)?.contains(element) && element !== $link.get(0))
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.height > 0);
        expect(Math.max(...rects.map((rect) => rect.bottom)), "end of the page").to.be.at.most(top);
      });
    });
  });

  it("looks the same on Home as on Expenses, fuchsia with a visible focus ring, though Home's sits in the brand card", () => {
    cy.viewport(375, 667);
    const looks = () =>
      addExpense()
        .focus()
        .then(($link) => {
          const style = getComputedStyle($link.get(0) as Element);
          return { background: style.backgroundColor, text: style.color, focus: style.outlineColor };
        });
    visitIn("/expenses", { locale: "es" });
    looks().then((onExpenses) => {
      visitIn("/", { locale: "es" });
      looks().should("deep.equal", onExpenses);
    });
  });

  it("stays in the page on a wide screen", () => {
    cy.viewport(1280, 800);
    visitIn("/expenses", { locale: "es" });
    addExpense().should(($link) => {
      expect(getComputedStyle($link.get(0) as Element).position).not.to.equal("fixed");
    });
  });
});
