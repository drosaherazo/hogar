import { rectOf, stubSignedIn, visitIn } from "../support/screens";

/**
 * Dialogs open as a bottom sheet on phones, so their buttons sit in thumb reach, and stay centered
 * from 48rem up. Each dialog the spec names is opened the way a person would.
 */
const dialogs = [
  {
    name: "record a payment",
    path: "/balances",
    open: () => cy.contains("button", "Anotar un pago").click(),
    action: "Anotar pago",
  },
  {
    name: "create a household",
    path: "/",
    stub: () => cy.intercept("GET", "/api/household", { body: { household: null, removedFrom: null } }),
    open: () => cy.contains("button", "Crear un hogar").click(),
    action: "Crear hogar",
  },
  {
    name: "change an expense's category",
    path: "/expenses/expense_1/edit",
    open: () => {
      cy.contains("label", "Categoría").click();
      cy.focused().select(1); // Rent, whose own split changes the shares
      cy.contains("button", "Guardar gasto").click();
    },
    action: "Guardar gasto",
  },
];

type DialogCase = (typeof dialogs)[number];

function openDialog({ path, open, ...rest }: DialogCase) {
  stubSignedIn("es");
  if ("stub" in rest) rest.stub();
  visitIn(path, { locale: "es" });
  open();
  return cy.get("[role=dialog]").should("be.visible");
}

describe("Dialogs on small and wide screens", () => {
  for (const dialog of dialogs) {
    it(`opens "${dialog.name}" as a full-width sheet at the bottom of a phone`, () => {
      cy.viewport(375, 667);
      // Retried until the opening animation has settled.
      openDialog(dialog).should(($dialog) => {
        const rect = rectOf($dialog);
        expect(rect.left, "left edge").to.equal(0);
        expect(rect.width, "width").to.equal(375);
        expect(rect.bottom, "bottom edge").to.be.closeTo(667, 1);
      });
    });

    it(`keeps "${dialog.name}" on screen and scrolls inside it on a short 320 px screen`, () => {
      // Roughly what a 320 px phone shows above an open keyboard.
      cy.viewport(320, 300);
      openDialog(dialog).should(($dialog) => {
        const rect = rectOf($dialog);
        expect(rect.top, "top edge").to.be.at.least(0);
        expect(rect.bottom, "bottom edge").to.be.closeTo(300, 1);
      });
      // The sheet itself scrolls to its actions; the page behind it stays put.
      cy.window().then((win) => {
        const pageScroll = win.scrollY;
        cy.get("[role=dialog]")
          .scrollTo("bottom")
          .should(($dialog) => {
            expect($dialog.get(0)?.scrollTop, "scrolled inside the sheet").to.be.greaterThan(0);
          });
        cy.window().its("scrollY").should("equal", pageScroll);
      });
      cy.get("[role=dialog]").contains("button", dialog.action).should("be.visible");
    });
  }

  it("stays centered on a wide screen", () => {
    cy.viewport(1280, 800);
    const [payment] = dialogs;
    if (!payment) throw new Error("No dialog to open");
    openDialog(payment).should(($dialog) => {
      const rect = rectOf($dialog);
      expect(rect.left + rect.width / 2, "horizontal center").to.be.closeTo(640, 1);
      expect(rect.top + rect.height / 2, "vertical center").to.be.closeTo(400, 1);
    });
  });
});
