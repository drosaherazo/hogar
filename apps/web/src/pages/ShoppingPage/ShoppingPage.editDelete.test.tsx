import type { ShoppingItemView } from "@hogar/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../test/renderApp";
import { MemoryStorage } from "../../test/memoryStorage";
import { apiError, handlers, homeView, server, shoppingItem } from "../../test/server";
import { expectNoA11yViolations } from "../../test/axe";

afterEach(() => {
  vi.restoreAllMocks();
});

const milk = shoppingItem({ id: "item_milk", name: "Milk", note: "lactose-free" });
const eggs = shoppingItem({ id: "item_eggs", name: "Eggs", addedAt: "2026-11-18T10:01:00.000Z" });

/** The names on the list, in order. */
function namesOnTheList() {
  return within(screen.getByRole("list", { name: "Shopping" }))
    .getAllByRole("listitem")
    .map((item) => item.firstElementChild?.firstElementChild?.textContent);
}

/** Opens the item's actions menu and picks `action`. */
async function choose(name: string, action: "Edit" | "Delete") {
  await userEvent.click(await screen.findByRole("button", { name: `Options for ${name}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

/** Serves `items`; a delete takes the item off the list the next read returns. */
function serveList(items: ShoppingItemView[]) {
  const deletes: string[] = [];
  const restores: string[] = [];
  let current = items;
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    http.get("*/api/household/shopping", () => HttpResponse.json({ items: current, lastCategoryId: null })),
    http.delete("*/api/household/shopping/items/:id", ({ request, params }) => {
      deletes.push(`${String(params["id"])}${new URL(request.url).search}`);
      current = current.filter((item) => item.id !== params["id"]);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("*/api/household/shopping/items/:id/restore", ({ params }) => {
      restores.push(String(params["id"]));
      const back = items.find((item) => item.id === params["id"]);
      if (!back) return apiError(404, "shopping.item.not_found");
      current = items.filter((item) => item.id === back.id || current.includes(item));
      return HttpResponse.json({ item: back });
    }),
  );
  return { deletes, restores };
}

describe("deleting an item", () => {
  it("takes it off the list at once and offers to undo it", async () => {
    const { deletes } = serveList([milk, eggs]);
    renderApp({ path: "/shopping" });

    await choose("Milk", "Delete");

    const toast = await screen.findByRole("alertdialog", { name: "You deleted Milk" });
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(deletes).toEqual(["item_milk?version=1"]);
    expect(namesOnTheList()).toEqual(["Eggs"]);
  });

  it("brings it back in its place with Undo, and says so", async () => {
    const { restores } = serveList([milk, eggs]);
    renderApp({ path: "/shopping" });
    await choose("Milk", "Delete");
    const toast = await screen.findByRole("alertdialog", { name: "You deleted Milk" });

    await userEvent.click(within(toast).getByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Milk is back on the list")).toHaveAttribute("role", "status");
    expect(restores).toEqual(["item_milk"]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(namesOnTheList()).toEqual(["Milk", "Eggs"]));
  });

  it("explains when it is too late to undo, leaving the item off the list", async () => {
    serveList([milk, eggs]);
    server.use(http.post("*/api/household/shopping/items/:id/restore", () => apiError(410, "shopping.undo.expired")));
    renderApp({ path: "/shopping" });
    await choose("Milk", "Delete");

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("It's too late to undo that.");
    expect(namesOnTheList()).toEqual(["Eggs"]);
  });

  it("puts the item back with the reason when the delete is refused", async () => {
    serveList([milk, eggs]);
    const changedMilk = { ...milk, note: "oat", version: 2 };
    server.use(
      http.delete("*/api/household/shopping/items/:id", () => {
        server.use(handlers.shopping([changedMilk, eggs]));
        return apiError(409, "shopping.item.changed");
      }),
    );
    renderApp({ path: "/shopping" });

    await choose("Milk", "Delete");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone changed it meanwhile. Here's the latest version.",
    );
    expect(await screen.findByText("oat")).toBeInTheDocument();
    expect(namesOnTheList()).toEqual(["Milk", "Eggs"]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the keyboard on the list: focus moves to the item now in its place", async () => {
    serveList([milk, eggs]);
    renderApp({ path: "/shopping" });

    await choose("Milk", "Delete");

    await waitFor(() => expect(screen.getByRole("button", { name: "Options for Eggs" })).toHaveFocus());
    await choose("Eggs", "Delete");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "What's needed?" })).toHaveFocus());
  });

  it("switches Undo off while offline, with the reason", async () => {
    const storage = new MemoryStorage();
    serveList([milk, eggs]);
    renderApp({ path: "/shopping", storage, installed: true });
    await choose("Milk", "Delete");
    const undo = await screen.findByRole("button", { name: "Undo" });

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => expect(undo).toBeDisabled());
    expect(undo).toHaveAccessibleDescription("Changes are available when you're back online.");
  });

  it("has no accessibility violations while the toast shows", async () => {
    serveList([milk, eggs]);
    const { container } = renderApp({ path: "/shopping" });
    await choose("Milk", "Delete");
    await screen.findByRole("alertdialog");
    await expectNoA11yViolations(container.ownerDocument.body);
  });
});

describe("who can change items", () => {
  it("gives guests no item actions", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: "GUEST" })), handlers.shopping([milk]));
    renderApp({ path: "/shopping" });
    expect(await screen.findByText("Milk")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Options for Milk" })).not.toBeInTheDocument();
  });

  it("switches item actions off while offline", async () => {
    const storage = new MemoryStorage();
    serveList([milk]);
    const online = renderApp({ path: "/shopping", storage, installed: true });
    await screen.findByText("Milk");
    await waitFor(() => expect(storage.contents()).toContain("item_milk"), { timeout: 3000 });
    online.unmount();

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    renderApp({ path: "/shopping", storage, installed: true });

    expect(await screen.findByRole("button", { name: "Options for Milk" })).toBeDisabled();
  });
});

/** Serves `items` and records every edit; `answer` can refuse one, else it is saved like the API would. */
function serveEdits(
  items: ShoppingItemView[],
  answer?: (id: string, body: Record<string, unknown>) => Response | null,
) {
  const edits: { id: string; body: Record<string, unknown> }[] = [];
  let current = items;
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    http.get("*/api/household/shopping", () => HttpResponse.json({ items: current, lastCategoryId: null })),
    http.patch("*/api/household/shopping/items/:id", async ({ request, params }) => {
      const id = String(params["id"]);
      const body = (await request.json()) as Record<string, unknown>;
      edits.push({ id, body });
      const refusal = answer?.(id, body);
      if (refusal) return refusal;
      const before = current.find((item) => item.id === id);
      if (!before) return apiError(404, "shopping.item.not_found");
      const saved = { ...before, ...body, version: before.version + 1 } as ShoppingItemView;
      current = current.map((item) => (item.id === id ? saved : item));
      return HttpResponse.json({ item: saved });
    }),
  );
  return {
    edits,
    /** Someone else's change, which the next read returns. */
    change: (item: ShoppingItemView) => (current = current.map((other) => (other.id === item.id ? item : other))),
  };
}

describe("editing an item", () => {
  it("fixes its name and note from the version it started from, and says it's saved", async () => {
    const { edits } = serveEdits([milk, eggs]);
    renderApp({ path: "/shopping" });

    await choose("Milk", "Edit");
    const dialog = await screen.findByRole("dialog", { name: "Edit “Milk”" });
    const name = within(dialog).getByRole("textbox", { name: "What's needed?" });
    expect(name).toHaveValue("Milk");
    expect(name).toHaveFocus();
    const note = within(dialog).getByRole("textbox", { name: "Note (optional)" });
    expect(note).toHaveValue("lactose-free");
    await userEvent.type(name, " (oat)");
    await userEvent.clear(note);
    await userEvent.type(note, "2 cartons");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Changes to Milk (oat) saved")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(edits).toEqual([{ id: "item_milk", body: { name: "Milk (oat)", note: "2 cartons", version: 1 } }]);
    // The page stays hidden from assistive technology for a moment after the dialog closes.
    await waitFor(() => expect(namesOnTheList()).toEqual(["Milk (oat)", "Eggs"]));
  });

  it("explains a missing name without sending anything, and closes without saving when nothing changed", async () => {
    const { edits } = serveEdits([milk]);
    renderApp({ path: "/shopping" });
    await choose("Milk", "Edit");
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "What's needed?" });

    await userEvent.clear(name);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(name).toHaveAccessibleDescription("Write what's needed.");

    await userEvent.type(name, "Milk ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(edits).toEqual([]);
  });

  it("shows someone else's newer version and keeps it when the person chooses so", async () => {
    const brunosMilk = { ...milk, note: "oat", version: 2 };
    const list = serveEdits([milk], () => {
      list.change(brunosMilk);
      return apiError(409, "shopping.item.changed");
    });
    renderApp({ path: "/shopping" });
    await choose("Milk", "Edit");
    const dialog = await screen.findByRole("dialog");
    const note = within(dialog).getByRole("textbox", { name: "Note (optional)" });
    await userEvent.clear(note);
    await userEvent.type(note, "soy");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    const notice = (await within(dialog).findByText("Someone changed this meanwhile")).closest("[role=status]");
    await waitFor(() => expect(notice).toHaveTextContent("Milkoat"));
    const keepNew = within(dialog).getByRole("button", { name: "Keep the new version" });
    expect(keepNew).toHaveFocus();
    await userEvent.click(keepNew);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(list.edits).toHaveLength(1);
    expect(await screen.findByText("oat")).toBeInTheDocument();
  });

  it("saves the person's version over the newer one when they choose so", async () => {
    const brunosMilk = { ...milk, note: "oat", version: 2 };
    const list = serveEdits([milk], (_, body) => {
      if (body["version"] !== 1) return null;
      list.change(brunosMilk);
      return apiError(409, "shopping.item.changed");
    });
    renderApp({ path: "/shopping" });
    await choose("Milk", "Edit");
    const dialog = await screen.findByRole("dialog");
    const note = within(dialog).getByRole("textbox", { name: "Note (optional)" });
    await userEvent.clear(note);
    await userEvent.type(note, "soy");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    const saveMine = await within(dialog).findByRole("button", { name: "Save mine" });
    await waitFor(() => expect(saveMine).toBeEnabled());
    await userEvent.click(saveMine);

    expect(await screen.findByText("Changes to Milk saved")).toBeInTheDocument();
    expect(list.edits.map((edit) => edit.body)).toEqual([
      { name: "Milk", note: "soy", version: 1 },
      { name: "Milk", note: "soy", version: 2 },
    ]);
    expect(await screen.findByText("soy")).toBeInTheDocument();
  });

  it("offers the person's note to the item that already has the new name", async () => {
    const list = serveEdits([milk, eggs], (id) =>
      id === "item_milk" ? apiError(409, "shopping.item.duplicate") : null,
    );
    renderApp({ path: "/shopping" });
    await choose("Milk", "Edit");
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "What's needed?" });
    await userEvent.clear(name);
    await userEvent.type(name, "EGGS");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByText("Eggs is already on the list.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Use my note" }));

    expect(await screen.findByText("Eggs now has your note")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(list.edits).toEqual([
      { id: "item_milk", body: { name: "EGGS", note: "lactose-free", version: 1 } },
      { id: "item_eggs", body: { note: "lactose-free", version: 1 } },
    ]);
  });

  it("has no accessibility violations with the dialog open", async () => {
    serveEdits([milk]);
    const { container } = renderApp({ path: "/shopping" });
    await choose("Milk", "Edit");
    await screen.findByRole("dialog");
    await expectNoA11yViolations(container.ownerDocument.body);
  });
});

describe("adding something already on the list", () => {
  it("offers to give the existing item the note the person wrote", async () => {
    const list = serveEdits([milk]);
    server.use(http.post("*/api/household/shopping/items", () => apiError(409, "shopping.item.duplicate")));
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("textbox", { name: "What's needed?" });
    await userEvent.type(name, "milk");
    await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), "oat{Enter}");
    expect(await screen.findByText("Milk is already on the list.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use my note" }));

    expect(await screen.findByText("Milk now has your note")).toHaveAttribute("role", "status");
    expect(list.edits).toEqual([{ id: "item_milk", body: { note: "oat", version: 1 } }]);
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
    expect(await screen.findByText("oat")).toBeInTheDocument();
  });

  it.each([
    ["no note", ""],
    ["the same note", " lactose-free "],
  ])("offers nothing when the person wrote %s", async (_, typed) => {
    serveEdits([milk]);
    server.use(http.post("*/api/household/shopping/items", () => apiError(409, "shopping.item.duplicate")));
    renderApp({ path: "/shopping" });

    await userEvent.type(await screen.findByRole("textbox", { name: "What's needed?" }), "Milk");
    if (typed) await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), typed);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Milk is already on the list.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use my note" })).not.toBeInTheDocument();
  });
});
