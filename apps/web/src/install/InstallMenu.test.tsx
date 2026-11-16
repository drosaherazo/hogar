import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../test/axe";
import { renderApp } from "../test/renderApp";
import { handlers, homeView, server } from "../test/server";
import { createInstallPrompt } from "./installPrompt";

/** The browser's install event, with the native dialog it opens. */
function installEvent() {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  return Object.assign(event, { prompt: vi.fn(() => Promise.resolve()) });
}

function browser({ installed = false, ios = false } = {}) {
  const target = new EventTarget();
  const install = createInstallPrompt({ target, isInstalled: () => installed, isIOS: () => ios });
  return { target, install };
}

async function openAccountMenu() {
  await userEvent.click(await screen.findByRole("button", { name: "Account menu for Ana García" }));
  return screen.findByRole("menu");
}

describe("Install Hogar in the account menu", () => {
  it("opens the browser's own install dialog where the browser offers one, and never a banner", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { target, install } = browser();
    const event = installEvent();
    act(() => {
      target.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);

    renderApp({ path: "/", install });
    await userEvent.click(within(await openAccountMenu()).getByRole("menuitem", { name: "Install Hogar" }));
    expect(event.prompt).toHaveBeenCalledOnce();

    // The browser lets each install event open its dialog only once.
    expect(within(await openAccountMenu()).queryByRole("menuitem", { name: "Install Hogar" })).not.toBeInTheDocument();
  });

  it("shows the two steps on iOS, in any browser", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/", install: browser({ ios: true }).install });
    await userEvent.click(within(await openAccountMenu()).getByRole("menuitem", { name: "Install Hogar" }));

    const sheet = await screen.findByRole("dialog", { name: "Add Hogar to your home screen" });
    const steps = within(sheet).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual(["Tap the Share button.", "Choose “Add to Home Screen”."]);
    await expectNoA11yViolations(document.body);
  });

  it.each([
    ["already running installed", { installed: true, ios: true }],
    ["in a browser that can't install apps", { installed: false, ios: false }],
  ])("is hidden when %s", async (_, options) => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { target, install } = browser(options);
    if (options.installed) target.dispatchEvent(installEvent());
    renderApp({ path: "/", install });
    expect(within(await openAccountMenu()).queryByRole("menuitem", { name: "Install Hogar" })).not.toBeInTheDocument();
  });

  it("goes away once Hogar has been installed", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { target, install } = browser();
    target.dispatchEvent(installEvent());
    renderApp({ path: "/", install });
    act(() => {
      target.dispatchEvent(new Event("appinstalled"));
    });
    expect(within(await openAccountMenu()).queryByRole("menuitem", { name: "Install Hogar" })).not.toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/", locale: "es", install: browser({ ios: true }).install });
    await userEvent.click(await screen.findByRole("button", { name: "Menú de la cuenta de Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Instalar Hogar" }));
    const sheet = await screen.findByRole("dialog", { name: "Añade Hogar a tu pantalla de inicio" });
    expect(within(sheet).getByText("Elige «Añadir a pantalla de inicio».")).toBeInTheDocument();
  });
});
