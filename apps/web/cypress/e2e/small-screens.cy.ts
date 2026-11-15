import { assertNoHorizontalScroll, assertTouchTargets, signedInPages, stubSignedIn, visitIn } from "../support/screens";

/**
 * Rules 1, 2 and 5 of "Small screens" in docs/design.md, checked in Spanish, whose copy runs
 * longest: 320 px is the narrowest phone Hogar guarantees (WCAG 2.2 1.4.10 Reflow), text at 200 %
 * on the 375 px design width must still fit without scrolling sideways, and every touch target on
 * the design width leaves room for a thumb.
 */
const screens = [
  { width: 320, textZoom: 1, label: "320 px" },
  { width: 375, textZoom: 2, label: "375 px with text at 200 %" },
] as const;

for (const { width, textZoom, label } of screens) {
  describe(`Small screens: ${label} in Spanish`, () => {
    beforeEach(() => {
      cy.viewport(width, 640);
    });

    it("fits the sign-in page without scrolling sideways", () => {
      visitIn("/login", { locale: "es", textZoom });
      assertNoHorizontalScroll();
    });

    for (const path of signedInPages) {
      it(`fits ${path} without scrolling sideways`, () => {
        stubSignedIn("es");
        visitIn(path, { locale: "es", textZoom });
        assertNoHorizontalScroll();
      });
    }
  });
}

describe("Small screens: touch targets at 375 px in Spanish", () => {
  beforeEach(() => {
    cy.viewport(375, 640);
  });

  it("gives every target on the sign-in page room for a thumb", () => {
    visitIn("/login", { locale: "es" });
    assertTouchTargets();
  });

  for (const path of signedInPages) {
    it(`gives every target on ${path} room for a thumb`, () => {
      stubSignedIn("es");
      visitIn(path, { locale: "es" });
      assertTouchTargets();
    });
  }
});
