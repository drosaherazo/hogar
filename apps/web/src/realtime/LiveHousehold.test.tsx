import { act, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { fakeHouseholdEvents } from "../test/fakeHouseholdEvents";
import { renderApp } from "../test/renderApp";
import { handlers, householdView, server, shoppingItem } from "../test/server";

/** What the browser says when the person switches tab, locks the phone or comes back. */
function setPageVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

afterEach(() => {
  setPageVisibility("visible");
});

/** Ana's home, open on the household's name, with the live connection let in. */
async function openHome() {
  const events = fakeHouseholdEvents();
  server.use(handlers.signedIn(), handlers.household(householdView({ name: "Casa Ana" })));
  renderApp({ path: "/", householdEvents: events });
  expect(await screen.findByRole("heading", { name: "Casa Ana" })).toBeInTheDocument();
  expect(events.isOpen).toBe(true);
  act(() => events.connect());
  return events;
}

describe("the live household", () => {
  it("shows another member's change as soon as the household announces it", async () => {
    const events = await openHome();

    server.use(handlers.household(householdView({ name: "Nuestra casa" })));
    act(() => events.emit("household:changed"));

    expect(await screen.findByRole("heading", { name: "Nuestra casa" })).toBeInTheDocument();
  });

  it("re-reads only the shopping list when it changes, not the rest of the household", async () => {
    const events = fakeHouseholdEvents();
    let householdReads = 0;
    server.use(
      handlers.signedIn(),
      http.get("*/api/household", () => {
        householdReads += 1;
        return HttpResponse.json({ household: householdView() });
      }),
    );
    renderApp({ path: "/", householdEvents: events });
    const card = await screen.findByRole("region", { name: "Shopping" });
    expect(await within(card).findByText("Nothing to buy right now")).toBeInTheDocument();
    const readsOnOpening = householdReads;

    server.use(handlers.shopping([shoppingItem()]));
    act(() => events.emit("shopping:changed"));

    expect(await within(card).findByText("1 thing to buy")).toBeInTheDocument();
    expect(householdReads).toBe(readsOnOpening);
  });

  it("disconnects while the page is hidden and catches up once it is back", async () => {
    const events = await openHome();

    setPageVisibility("hidden");
    expect(events.isOpen).toBe(false);
    server.use(handlers.household(householdView({ name: "Nuestra casa" })));

    setPageVisibility("visible");
    expect(events.isOpen).toBe(true);
    act(() => events.connect());
    expect(await screen.findByRole("heading", { name: "Nuestra casa" })).toBeInTheDocument();
  });

  it("shows the removal notice at once when someone is removed, and disconnects", async () => {
    const events = await openHome();

    server.use(handlers.noHousehold("Casa Ana"));
    act(() => events.emit("household:changed"));

    expect(await screen.findByText(/You're no longer part of Casa Ana/)).toBeInTheDocument();
    expect(events.isOpen).toBe(false);
  });

  it("doesn't connect for someone without a household", async () => {
    const events = fakeHouseholdEvents();
    server.use(handlers.signedIn(), handlers.noHousehold());
    renderApp({ path: "/", householdEvents: events });

    expect(await screen.findByRole("button", { name: "Create a household" })).toBeInTheDocument();
    expect(events.isOpen).toBe(false);
  });
});
