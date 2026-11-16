import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAgo } from "../i18n/format";
import { expectNoA11yViolations } from "../test/axe";
import { MemoryStorage } from "../test/memoryStorage";
import { renderApp } from "../test/renderApp";
import { anaIsOwed, handlers, homeView, server, session } from "../test/server";

const BANNER = /You're offline\. This is what Hogar showed you/;

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

function goOnline(online: boolean) {
  setOnline(online);
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

/** Ana uses the installed app online on the balances, which it keeps. */
async function useInstalledAppOnline(storage: MemoryStorage, path = "/balances") {
  server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
  const app = renderApp({ path, storage, installed: true });
  await screen.findByText("You're owed €7.70 in total");
  await waitFor(() => expect(storage.contents()).toContain("myBalanceCents"), { timeout: 3000 });
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Offline view", () => {
  it("opens without a connection on the last data, says when it is from, and still says who owes whom", async () => {
    const storage = new MemoryStorage();
    (await useInstalledAppOnline(storage)).unmount();

    setOnline(false);
    const { container } = renderApp({ path: "/balances", storage, installed: true });
    expect(await screen.findByText(BANNER)).toHaveTextContent(
      "You're offline. This is what Hogar showed you just now. Changes are available when you're back online.",
    );
    expect(screen.getByText("You're owed €7.70 in total")).toBeInTheDocument();
    expect(screen.queryByText("Knocking on your home's door…")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("switches off everything that changes data, saying why", async () => {
    const storage = new MemoryStorage();
    (await useInstalledAppOnline(storage, "/expenses")).unmount();

    setOnline(false);
    renderApp({ path: "/expenses", storage, installed: true });
    await screen.findByText(BANNER);
    const add = screen.getByText("Add expense").closest("a");
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).not.toHaveAttribute("href");
    expect(add).toHaveAccessibleDescription("Changes are available when you're back online.");
    for (const button of within(screen.getByRole("main")).queryAllByRole("button")) expect(button).toBeDisabled();
  });

  it("shows a friendly empty state when nothing was kept, never the wake-up screen", async () => {
    setOnline(false);
    const { container } = renderApp({ path: "/", installed: true });
    expect(await screen.findByRole("heading", { level: 1, name: "You're offline" })).toBeInTheDocument();
    expect(screen.getByText("Hogar will be back as soon as you reconnect.")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("keeps showing the kept data while the session comes back, then health, one refresh and only then the data", async () => {
    const storage = new MemoryStorage();
    (await useInstalledAppOnline(storage)).unmount();

    const order: string[] = [];
    let wake: () => void = () => undefined;
    const awake = new Promise<void>((resolve) => {
      wake = resolve;
    });
    server.use(
      http.get("*/api/health", async () => {
        order.push("health");
        await awake;
        return HttpResponse.json({ status: "ok" });
      }),
      http.post("*/api/auth/refresh", () => {
        order.push("refresh");
        return HttpResponse.json(session());
      }),
      http.get("*/api/household*", ({ request }) => {
        order.push(new URL(request.url).pathname);
        return HttpResponse.json({ household: homeView() });
      }),
    );
    setOnline(false);
    renderApp({ path: "/balances", storage, installed: true });
    await screen.findByText(BANNER);

    goOnline(true);
    await waitFor(() => expect(order).toContain("health"));
    // The server is still waking: the kept data stays, read-only, and no wake-up screen appears.
    expect(screen.getByText("You're owed €7.70 in total")).toBeInTheDocument();
    expect(screen.getByText(BANNER)).toBeInTheDocument();
    expect(screen.queryByText("Knocking on your home's door…")).not.toBeInTheDocument();

    wake();
    await waitFor(() => expect(screen.queryByText(BANNER)).not.toBeInTheDocument());
    expect(order.slice(0, 2)).toEqual(["health", "refresh"]);
    expect(order.filter((step) => step === "refresh")).toHaveLength(1);
  });

  it("shows the empty state when the person was kept but no household was (not in one yet)", async () => {
    const storage = new MemoryStorage();
    server.use(handlers.signedIn(), handlers.noHousehold());
    const first = renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("button", { name: "Create a household" });
    await waitFor(() => expect(storage.contents()).toContain("Ana García"));
    first.unmount();

    setOnline(false);
    renderApp({ path: "/", storage, installed: true });
    expect(await screen.findByRole("heading", { level: 1, name: "You're offline" })).toBeInTheDocument();
  });

  it("switches changes off when the connection drops while in use, and back on when it returns", async () => {
    await useInstalledAppOnline(new MemoryStorage(), "/expenses");
    const add = () => screen.getByText("Add expense").closest("a");
    expect(add()).toHaveAttribute("href", "/expenses/new");

    goOnline(false);
    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(add()).toHaveAttribute("aria-disabled", "true");

    goOnline(true);
    await waitFor(() => expect(add()).toHaveAttribute("href", "/expenses/new"));
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
  });
});

describe("formatAgo", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  const minutes = (count: number) => now - count * 60_000;

  it.each([
    [minutes(0.5), "en", "this minute"],
    [minutes(5), "en", "5 minutes ago"],
    [minutes(120), "en", "2 hours ago"],
    [minutes(24 * 60), "en", "yesterday"],
    [minutes(3 * 24 * 60), "en", "3 days ago"],
    [minutes(5), "es", "hace 5 minutos"],
    [minutes(24 * 60), "es", "ayer"],
  ] as const)("says %s in %s as %s", (at, locale, expected) => {
    expect(formatAgo(at, now, locale)).toBe(expected);
  });
});
