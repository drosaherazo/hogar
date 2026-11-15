import { stubSignedIn, visitIn } from "../support/screens";

/**
 * Dialogs open as a bottom sheet on phones, so their buttons sit in thumb reach, and stay centered
 * from 48rem up. Measured on "Record a payment", which every dialog shares its layout with.
 */
function openPaymentDialog() {
  stubSignedIn("es");
  visitIn("/balances", { locale: "es" });
  cy.contains("button", "Anotar un pago").click();
  return cy.get("[role=dialog]").should("be.visible");
}

describe("Dialogs on small and wide screens", () => {
  it("slides up from the bottom, full width, on a phone", () => {
    cy.viewport(375, 667);
    // Retried until the opening animation has settled.
    openPaymentDialog().should(($dialog) => {
      const rect = $dialog[0]!.getBoundingClientRect();
      expect(rect.left, "left edge").to.equal(0);
      expect(rect.width, "width").to.equal(375);
      expect(rect.bottom, "bottom edge").to.be.closeTo(667, 1);
    });
  });

  it("keeps its actions reachable inside the sheet when the keyboard leaves little room", () => {
    // A 320 px phone with the keyboard open leaves roughly this much of the screen.
    cy.viewport(320, 300);
    // Retried until the opening animation has settled.
    openPaymentDialog().should(($dialog) => {
      expect($dialog[0]!.getBoundingClientRect().bottom, "bottom edge").to.be.at.most(300);
    });
    cy.get("[role=dialog]").contains("button", "Anotar pago").scrollIntoView().should("be.visible");
  });

  it("stays centered on a wide screen", () => {
    cy.viewport(1280, 800);
    // Retried until the opening animation has settled.
    openPaymentDialog().should(($dialog) => {
      const rect = $dialog[0]!.getBoundingClientRect();
      expect(rect.left + rect.width / 2, "horizontal center").to.be.closeTo(640, 1);
      expect(rect.top + rect.height / 2, "vertical center").to.be.closeTo(400, 1);
    });
  });
});
