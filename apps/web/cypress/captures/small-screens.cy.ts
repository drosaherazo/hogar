import { LOCALES, type Locale } from "@hogar/shared";
import i18next from "i18next";
import { NAMESPACES, resources } from "../../src/i18n/resources";
import { ana, session } from "../support/e2e";
import type { Theme } from "../../src/theme/theme";
import {
  BRUNO,
  CARLA,
  invitation,
  invitationPreview,
  shoppingItems,
  signedInPages,
  stubSignedIn,
  visitIn,
} from "../support/screens";

/**
 * Screenshots of every screen and dialog on small phones, for the "Small screens" audit in
 * docs/design.md: 320 px (the guaranteed minimum) and 375 px (the design width), in both
 * languages and themes. Not an E2E test and never committed: it lives outside cypress/e2e so CI
 * never runs it. Run it with `pnpm --filter @hogar/web capture:small-screens`; the images land
 * in cypress/screenshots (git-ignored).
 */

const widths = [320, 375] as const;
const themes: Theme[] = ["light", "dark"];

/** The app's own copy, so the same steps open each dialog in either language. */
function copy(locale: Locale) {
  const instance = i18next.createInstance();
  void instance.init({
    resources,
    ns: NAMESPACES,
    lng: locale,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

// Full-page screenshots sometimes stall in headless Electron; give them room and a retry.
const pageShot = { capture: "fullPage", timeout: 60_000 } as const;
const viewportShot = { capture: "viewport", timeout: 60_000 } as const;

/** Each dialog: where it lives, how to open it, and what the server must say for it to exist. */
interface DialogCapture {
  name: string;
  path: string;
  stub?: () => void;
  open: (t: ReturnType<typeof copy>) => void;
}

const dialogs: DialogCapture[] = [
  {
    name: "create-household",
    path: "/",
    stub: () => cy.intercept("GET", "/api/household", { body: { household: null, removedFrom: null } }),
    open: (t) => cy.contains("button", t("home:noHousehold.create")).click(),
  },
  {
    name: "record-payment",
    path: "/balances",
    open: (t) => cy.contains("button", t("expenses:suggest.record")).click(),
  },
  {
    name: "payment-details",
    path: "/expenses",
    open: () => cy.contains("button", CARLA).click(),
  },
  {
    name: "category-change",
    path: "/expenses/expense_1/edit",
    open: (t) => {
      cy.contains("label", t("expenses:form.category.label")).click();
      cy.focused().select(1); // Rent, whose own split changes the shares
      cy.contains("button", t("expenses:form.save")).click();
    },
  },
  {
    name: "delete-expense",
    path: "/expenses/expense_1",
    open: (t) => cy.contains("button", t("expenses:details.remove")).click(),
  },
  {
    name: "category",
    path: "/household/settings",
    open: (t) => cy.contains("button", t("household:settings.categories.add")).click(),
  },
  {
    name: "invitation-link",
    path: "/household/settings",
    stub: () =>
      cy.intercept("POST", "/api/household/invitations", {
        statusCode: 201,
        body: { token: "tok_capture", invitation: invitation("inv_2") },
      }),
    open: (t) => cy.contains("button", t("household:settings.invitations.create")).click(),
  },
  {
    name: "remove-member",
    path: "/household/settings",
    open: (t) => {
      cy.get(`button[aria-label="${t("household:settings.members.options", { name: BRUNO })}"]`).click();
      cy.contains("[role=menuitem]", t("household:settings.members.remove")).click();
    },
  },
  {
    name: "leave-household",
    path: "/household/settings",
    open: (t) => cy.contains("button", t("household:settings.members.leave")).click(),
  },
  {
    name: "edit-item",
    path: "/shopping",
    open: (t) => {
      cy.get(`button[aria-label="${t("shopping:item.actions", { name: shoppingItems[0]?.name ?? "" })}"]`).click();
      cy.contains("[role=menuitem]", t("shopping:item.edit")).click();
    },
  },
  {
    name: "invite-leave-first",
    path: "/invite#tok_join",
    stub: () =>
      cy.intercept("POST", "/api/invitations/lookup", { ...invitationPreview, viewer: "has_other_household" }),
    open: (t) => cy.contains("button", t("household:invite.leave")).click(),
  },
];

describe("Small-screen captures", { retries: 2 }, () => {
  for (const width of widths) {
    for (const locale of LOCALES) {
      for (const theme of themes) {
        const folder = `${width}/${locale}-${theme}`;
        const t = copy(locale);

        describe(folder, () => {
          beforeEach(() => {
            cy.viewport(width, 720);
          });

          it("captures sign-in", () => {
            visitIn("/login", { locale, theme });
            cy.screenshot(`${folder}/sign-in`, pageShot);
          });

          it("captures the wake-up screen", () => {
            cy.intercept("GET", "/api/health", { statusCode: 503, body: "starting" });
            cy.intercept("POST", "/api/auth/refresh", session({ ...ana, locale }));
            visitIn("/", { locale, theme, until: "wake-up" });
            cy.screenshot(`${folder}/wake-up`, pageShot);
          });

          for (const path of signedInPages) {
            it(`captures ${path}`, () => {
              stubSignedIn(locale);
              visitIn(path, { locale, theme });
              cy.screenshot(`${folder}/page${path.replace(/[/#]+/g, "-")}`, pageShot);
            });
          }

          it("captures the toast after deleting an item", () => {
            stubSignedIn(locale);
            cy.intercept("DELETE", "/api/household/shopping/items/*", { statusCode: 204 });
            visitIn("/shopping", { locale, theme });
            const item = shoppingItems[0]?.name ?? "";
            cy.get(`button[aria-label="${t("shopping:item.actions", { name: item })}"]`).click();
            cy.contains("[role=menuitem]", t("shopping:item.delete")).click();
            cy.get("[role=alertdialog]").should("be.visible");
            cy.screenshot(`${folder}/toast-deleted`, viewportShot);
          });

          for (const dialog of dialogs) {
            it(`captures the ${dialog.name} dialog`, () => {
              stubSignedIn(locale);
              dialog.stub?.();
              visitIn(dialog.path, { locale, theme });
              dialog.open(t);
              cy.get("[role=dialog]").should("be.visible");
              cy.screenshot(`${folder}/dialog-${dialog.name}`, viewportShot);
            });
          }
        });
      }
    }
  }
});
