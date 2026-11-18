import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { fakeHouseholdEvents } from "../../test/fakeHouseholdEvents";
import { MemoryStorage } from "../../test/memoryStorage";
import { renderApp } from "../../test/renderApp";
import { anaRef, apiError, handlers, homeView, personRef, server, shoppingItem } from "../../test/server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ShoppingPage", () => {
  it("shows the list in the order added, saying who asked for other people's items", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.shopping([
        shoppingItem({ id: "item_milk", name: "Milk", note: "lactose-free" }),
        shoppingItem({ id: "item_eggs", name: "Eggs", askedBy: anaRef }),
        shoppingItem({
          id: "item_bread",
          name: "Bread",
          askedBy: personRef({ userId: "user_carla", name: "Carla Ruiz", former: true }),
        }),
      ]),
    );
    renderApp({ path: "/shopping" });

    expect(await screen.findByRole("heading", { level: 1, name: "Shopping" })).toBeInTheDocument();
    const items = within(await screen.findByRole("list", { name: "Shopping" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Milklactose-freeasked for by Bruno Díaz",
      "Eggs",
      "Breadasked for by Carla Ruiz (former member)",
    ]);
  });

  it("says nobody's name while the household hides who asked", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ showWhoAsked: false })),
      handlers.shopping([
        shoppingItem({ id: "item_milk", name: "Milk", note: "lactose-free", askedBy: undefined }),
        shoppingItem({ id: "item_eggs", name: "Eggs", askedBy: undefined }),
      ]),
    );
    renderApp({ path: "/shopping" });

    const items = within(await screen.findByRole("list", { name: "Shopping" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Milklactose-free", "Eggs"]);
  });

  it("hides who asked as soon as an admin turns it off, without reloading", async () => {
    const householdEvents = fakeHouseholdEvents();
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.shopping([shoppingItem()]));
    renderApp({ path: "/shopping", householdEvents });
    expect(await screen.findByText("asked for by Bruno Díaz")).toBeInTheDocument();
    act(() => householdEvents.connect());

    server.use(
      handlers.household(homeView({ showWhoAsked: false })),
      handlers.shopping([shoppingItem({ askedBy: undefined })]),
    );
    act(() => householdEvents.emit("household:changed"));

    await waitFor(() => expect(screen.queryByText("asked for by Bruno Díaz")).not.toBeInTheDocument());
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("adds an item with a note at the end of the list, ready for the next one", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.shopping([shoppingItem()]),
      http.post("*/api/household/shopping/items", async ({ request }) => {
        body = await request.json();
        const eggs = shoppingItem({ id: "item_eggs", name: "Eggs", note: "a dozen", askedBy: anaRef });
        server.use(handlers.shopping([shoppingItem(), eggs]));
        return HttpResponse.json({ item: eggs }, { status: 201 });
      }),
    );
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "  Eggs ");
    await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), "a dozen{Enter}");

    expect(await screen.findByText("You added Eggs")).toHaveAttribute("role", "status");
    expect(body).toEqual({ name: "Eggs", note: "a dozen" });
    const items = within(screen.getByRole("list", { name: "Shopping" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Milkasked for by Bruno Díaz", "Eggsa dozen"]);
    expect(name).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue("");
    expect(name).toHaveFocus();
  });

  it("shows an item someone else adds as soon as the household announces it", async () => {
    const events = fakeHouseholdEvents();
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.shopping([shoppingItem()]));
    renderApp({ path: "/shopping", householdEvents: events });
    const list = await screen.findByRole("list", { name: "Shopping" });

    // Bruno adds eggs on his phone: the API now lists them and says the list changed.
    server.use(handlers.shopping([shoppingItem(), shoppingItem({ id: "item_eggs", name: "Eggs" })]));
    act(() => events.emit("shopping:changed"));

    expect(await within(list).findByText("Eggs")).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Milkasked for by Bruno Díaz", "Eggsasked for by Bruno Díaz"]);
  });

  it("kindly says when the item is already on the list, keeping what was typed", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.shopping([shoppingItem({ name: "Leche" })]),
      http.post("*/api/household/shopping/items", () => apiError(409, "shopping.item.duplicate")),
    );
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "LECHÉ{Enter}");

    expect(await screen.findByText("Leche is already on the list.")).toBeInTheDocument();
    expect(name).toHaveValue("LECHÉ");
    // Typing something else clears the notice.
    await userEvent.type(name, "s");
    expect(screen.queryByText("Leche is already on the list.")).not.toBeInTheDocument();
  });

  it("explains a missing or long name and a long note without sending anything", async () => {
    let posts = 0;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/shopping/items", () => {
        posts += 1;
        return apiError(500, "server.unexpected");
      }),
    );
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "   {Enter}");
    expect(name).toHaveAccessibleDescription("Write what's needed.");

    await userEvent.clear(name);
    await userEvent.click(name);
    await userEvent.paste("a".repeat(51));
    const note = screen.getByRole("textbox", { name: "Note (optional)" });
    await userEvent.click(note);
    await userEvent.paste("b".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(name).toHaveAccessibleDescription("Keep it to 50 characters; details go in the note.");
    expect(note).toHaveAccessibleDescription("The note fits up to 100 characters. Brand, size, how many…");
    expect(posts).toBe(0);
  });

  it("says what went wrong when an item can't be added", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/shopping/items", () => apiError(500, "server.unexpected")),
    );
    renderApp({ path: "/shopping" });

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "Milk{Enter}");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "What's needed?" })).toHaveValue("Milk");
  });

  it("shows a friendly empty state when nothing is needed", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { container } = renderApp({ path: "/shopping" });

    expect(await screen.findByRole("heading", { level: 2, name: "Nothing to buy" })).toBeInTheDocument();
    expect(screen.getByText("When something runs out, add it here and everyone will see it.")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("lets guests read the list, without a way to add to it", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ myRole: "GUEST" })),
      handlers.shopping([shoppingItem()]),
    );
    const { container } = renderApp({ path: "/shopping" });

    expect(await screen.findByText("As a guest you can see the list but not change it.")).toBeInTheDocument();
    expect(await screen.findByText("Milk")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("keeps the last list in the installed app and switches adding off without a connection", async () => {
    const storage = new MemoryStorage();
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.shopping([shoppingItem()]));
    const online = renderApp({ path: "/shopping", storage, installed: true });
    await screen.findByText("Milk");
    await waitFor(() => expect(storage.contents()).toContain("item_milk"), { timeout: 3000 });
    online.unmount();

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    renderApp({ path: "/shopping", storage, installed: true });

    expect(await screen.findByText("Milk")).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "What's needed?" })).toBeDisabled();
    await waitFor(() =>
      expect(add.closest("fieldset")).toHaveAccessibleDescription("Changes are available when you're back online."),
    );
  });

  it("has no accessibility violations with items on the list", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.shopping([
        shoppingItem({ note: "lactose-free" }),
        shoppingItem({ id: "item_eggs", name: "Eggs", askedBy: anaRef }),
      ]),
    );
    const { container } = renderApp({ path: "/shopping" });
    await screen.findByText("Eggs");
    await expectNoA11yViolations(container);
  });
});
