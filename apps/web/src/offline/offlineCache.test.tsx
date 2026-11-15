import type { AuthUser } from "@hogar/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "../test/memoryStorage";
import { renderApp } from "../test/renderApp";
import { apiError, handlers, homeView, server } from "../test/server";

const bruno: AuthUser = {
  id: "user_bruno",
  email: "bruno@example.com",
  name: "Bruno Díaz",
  avatarUrl: null,
  locale: "es",
};

/** A household request that never answers, so only kept data can fill the page. */
const householdNeverAnswers = () => http.get("*/api/household", () => new Promise<never>(() => undefined));

const DAY_MS = 24 * 60 * 60 * 1000;

/** First launch of the installed app: Ana signs in and sees her household, which gets kept. */
async function firstLaunch(storage: MemoryStorage) {
  server.use(handlers.signedIn(), handlers.household(homeView()));
  const app = renderApp({ path: "/", storage, installed: true });
  await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
  await screen.findByText("Casa Ana");
  await waitFor(() => expect(storage.contents()).toContain("Casa Ana"), { timeout: 3000 });
  return app;
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Offline cache: what the installed app keeps", () => {
  it("keeps the household's data in the installed app and shows it on the next launch", async () => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();

    server.use(handlers.signedIn(), householdNeverAnswers());
    renderApp({ path: "/", storage, installed: true });
    expect(await screen.findByText("Casa Ana")).toBeInTheDocument();
  });

  it("keeps nothing in a browser tab", async () => {
    const storage = new MemoryStorage();
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/", storage, installed: false });
    await screen.findByText("Casa Ana");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(storage.length).toBe(0);
  });

  it("keeps the person's public profile, and never a token or anything else from the session", async () => {
    const storage = new MemoryStorage();
    await firstLaunch(storage);
    const kept = storage.contents();
    expect(kept).toContain('"id":"user_ana"');
    expect(kept).toContain('"name":"Ana García"');
    expect(kept).not.toContain("access-1");
    expect(kept).not.toContain("ana@example.com");
    expect(kept.toLowerCase()).not.toMatch(/token|refresh|cookie/);
  });

  it("discards data older than seven days", async () => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 8 * DAY_MS);
    server.use(handlers.signedIn(), householdNeverAnswers());
    renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    expect(screen.queryByText("Casa Ana")).not.toBeInTheDocument();
    await waitFor(() => expect(storage.contents()).not.toContain("Casa Ana"));
  });

  it("leaves what it kept alone when the app starts without a connection", async () => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();
    const kept = storage.contents();

    setOnline(false);
    renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("heading", { level: 1 });
    expect(storage.contents()).toBe(kept);
  });
});

describe("Offline cache: when it's erased", () => {
  it("on sign-out", async () => {
    const storage = new MemoryStorage();
    await firstLaunch(storage);
    await userEvent.click(screen.getByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Email me a code" });
    await waitFor(() => expect(storage.contents()).not.toMatch(/Casa Ana|Ana García/));
  });

  it.each([
    ["expired", "auth.session.expired"],
    ["revoked", "auth.session.reused"],
  ] as const)("when the server says the session %s", async (_, code) => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();

    server.use(http.post("*/api/auth/refresh", () => apiError(401, code)));
    renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("button", { name: "Email me a code" });
    expect(storage.contents()).not.toMatch(/Casa Ana|Ana García/);
  });

  it("when the removal notice appears", async () => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();

    server.use(
      handlers.signedIn(),
      http.get("*/api/household", () => HttpResponse.json({ household: null, removedFrom: "Casa Ana" })),
      http.delete("*/api/me/removal-notice", () => new HttpResponse(null, { status: 204 })),
    );
    renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("button", { name: "Create a household" });
    await waitFor(() => expect(storage.contents()).not.toContain('"household":{'));
  });

  it("when someone else signs in, before anything of the last person is shown", async () => {
    const storage = new MemoryStorage();
    (await firstLaunch(storage)).unmount();

    server.use(handlers.signedIn(bruno), householdNeverAnswers());
    renderApp({ path: "/", storage, installed: true });
    await screen.findByRole("heading", { level: 1, name: "Hola, Bruno" });
    expect(screen.queryByText("Casa Ana")).not.toBeInTheDocument();
    expect(storage.contents()).not.toMatch(/Casa Ana|Ana García/);
    expect(storage.contents()).toContain('"name":"Bruno Díaz"');
  });
});
