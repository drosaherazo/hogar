import { LANGUAGE_STORAGE_KEY } from "../../src/i18n";
import { activity, household, stubSignedIn } from "../support/screens";

/**
 * The offline view (ADR 0015): the installed app keeps what it showed, and opened again without a
 * connection it shows that, read-only, instead of the browser's offline page or the wake-up screen.
 * The service worker doesn't run in E2E, so Vite serves the page and every /api call fails.
 */
function openInstalledApp(path: string, { online }: { online: boolean }) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
      const matchMedia = win.matchMedia.bind(win);
      cy.stub(win, "matchMedia").callsFake((query: string) =>
        query.includes("display-mode: standalone")
          ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
          : matchMedia(query),
      );
      if (!online) Object.defineProperty(win.navigator, "onLine", { configurable: true, get: () => false });
    },
  });
}

const expenseDescription = activity.items[0]?.kind === "expense" ? activity.items[0].description : "";

describe("Offline view", () => {
  it("opens without a connection on the last data it saw, read-only, without the wake-up screen", () => {
    stubSignedIn("es");
    openInstalledApp("/", { online: true });
    cy.contains(household.name).should("be.visible");
    cy.get("nav").contains("a", "Gastos").click();
    cy.contains(expenseDescription).should("be.visible");
    // Kept once the persister has saved what the screens loaded.
    cy.window().should((win) => {
      expect(win.localStorage.getItem("hogar-offline-data") ?? "").to.contain(expenseDescription);
    });

    cy.intercept("/api/**", { forceNetworkError: true });
    openInstalledApp("/expenses", { online: false });

    cy.contains("[role=status]", "Estás sin conexión. Esto es lo que Hogar te mostró").should("be.visible");
    cy.contains(expenseDescription).should("be.visible");
    cy.contains("a", "Añadir gasto").should("have.attr", "aria-disabled", "true").and("not.have.attr", "href");
    cy.contains("Llamando a la puerta").should("not.exist");

    cy.get("nav").contains("a", "Inicio").click();
    cy.contains(household.name).should("be.visible");
  });
});
