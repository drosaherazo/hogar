import { assertNoHorizontalScroll, signedInPages, stubSignedIn, visitIn } from "../support/screens";

/**
 * 320 px is the narrowest phone Hogar guarantees (WCAG 2.2 1.4.10 Reflow), checked in Spanish,
 * whose copy runs longest. Rule 1 of "Small screens" in docs/design.md.
 */
describe("Small screens: 320 px in Spanish", () => {
  beforeEach(() => {
    cy.viewport(320, 640);
  });

  it("fits the sign-in page without scrolling sideways", () => {
    visitIn("/login", { locale: "es" });
    assertNoHorizontalScroll();
  });

  for (const path of signedInPages) {
    it(`fits ${path} without scrolling sideways`, () => {
      stubSignedIn("es");
      visitIn(path, { locale: "es" });
      assertNoHorizontalScroll();
    });
  }
});
