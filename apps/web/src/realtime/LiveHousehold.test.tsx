import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeHouseholdEvents } from "../test/fakeHouseholdEvents";
import { renderApp } from "../test/renderApp";
import { handlers, householdView, server } from "../test/server";

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
