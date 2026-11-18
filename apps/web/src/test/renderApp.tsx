import type { Locale } from "@hogar/shared";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ApiClient } from "../api/client";
import { AppProviders, createRoutes } from "../App";
import { createI18n, LANGUAGE_STORAGE_KEY } from "../i18n";
import type { AppUpdate } from "../update/appUpdate";
import { createInstallPrompt, type InstallPrompt } from "../install/installPrompt";
import { fakeHouseholdEvents, type FakeHouseholdEvents } from "./fakeHouseholdEvents";
import { fakeServiceWorker } from "./fakeServiceWorker";
import { MemoryStorage } from "./memoryStorage";

/**
 * Fake Google Identity Services: renders a plain button that hands back `credential`,
 * the way Google's popup would after a successful sign-in.
 */
export function installFakeGoogle(credential = "google-id-token") {
  let callback: ((response: GoogleCredentialResponse) => void) | null = null;
  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          callback = config.callback;
        },
        renderButton: (parent) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Continue with Google";
          button.addEventListener("click", () => callback?.({ credential }));
          parent.appendChild(button);
        },
        disableAutoSelect: () => undefined,
      },
    },
  };
}

export interface RenderAppOptions {
  path?: string;
  /** A language the person picked themselves (stored, so it wins over the account's locale). */
  locale?: Locale;
  googleClientId?: string | undefined;
  /** The device's storage, shared between launches; a fresh one by default. */
  storage?: Storage;
  /** Whether Hogar runs as the installed app (display mode standalone). */
  installed?: boolean;
  /** The service worker's new versions; none arrive unless the test says so. */
  update?: AppUpdate;
  /** How the browser lets Hogar be installed; by default it can't be. */
  install?: InstallPrompt;
  /** The household's live connection; by default the server never lets it in. */
  householdEvents?: FakeHouseholdEvents;
}

export function renderApp(options: RenderAppOptions = {}) {
  const {
    path = "/",
    locale,
    storage = new MemoryStorage(),
    installed = false,
    update = fakeServiceWorker().update,
    install = createInstallPrompt({ target: new EventTarget(), isInstalled: () => false, isIOS: () => false }),
    householdEvents = fakeHouseholdEvents(),
  } = options;
  const googleClientId = "googleClientId" in options ? options.googleClientId : "test-client-id";
  if (locale) localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  const i18n = createI18n({ lng: locale ?? "en" });
  const client = new ApiClient("http://localhost/api");
  const router = createMemoryRouter(createRoutes({ googleClientId }), { initialEntries: [path] });
  const result = render(
    <AppProviders
      i18n={i18n}
      client={client}
      offline={{ storage: () => storage, isInstalled: () => installed }}
      update={update}
      install={install}
      householdEvents={householdEvents.source}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, client, i18n };
}
