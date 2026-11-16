import type { Locale } from "@hogar/shared";
import type { Theme } from "../../src/theme/theme";
import { signedInPages, stubSignedIn, visitIn } from "../support/screens";

/**
 * Screenshots of every signed-in page on a desktop, for reviewing how Hogar uses a wide screen
 * (#88): `pnpm --filter @hogar/web capture:desktop`. Not committed.
 */
const looks: { locale: Locale; theme: Theme }[] = [
  { locale: "es", theme: "light" },
  { locale: "en", theme: "dark" },
];

describe("Desktop captures", { retries: 2 }, () => {
  for (const { locale, theme } of looks) {
    const folder = `1280/${locale}-${theme}`;
    describe(folder, () => {
      beforeEach(() => {
        cy.viewport(1280, 800);
      });

      for (const path of signedInPages) {
        it(`captures ${path}`, () => {
          stubSignedIn(locale);
          visitIn(path, { locale, theme });
          cy.screenshot(`${folder}/page${path.replace(/[/#]+/g, "-")}`, { capture: "fullPage", timeout: 60_000 });
        });
      }
    });
  }
});
