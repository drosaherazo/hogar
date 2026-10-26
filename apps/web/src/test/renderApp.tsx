import type { Locale } from "@hogar/shared";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ApiClient } from "../api/client";
import { AppProviders, createRoutes } from "../App";
import { createI18n, LANGUAGE_STORAGE_KEY } from "../i18n";

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
}

export function renderApp(options: RenderAppOptions = {}) {
  const { path = "/", locale } = options;
  const googleClientId = "googleClientId" in options ? options.googleClientId : "test-client-id";
  if (locale) localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  const i18n = createI18n({ lng: locale ?? "en" });
  const client = new ApiClient("http://localhost/api");
  const router = createMemoryRouter(createRoutes({ googleClientId }), { initialEntries: [path] });
  const result = render(
    <AppProviders i18n={i18n} client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, router, client, i18n };
}
