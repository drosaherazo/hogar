import type { ShoppingItemView } from "@hogar/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { MemoryStorage } from "../../test/memoryStorage";
import { renderApp } from "../../test/renderApp";
import { anaRef, apiError, brunoRef, handlers, homeView, server, shoppingItem } from "../../test/server";

afterEach(() => {
  vi.restoreAllMocks();
});

const milk = shoppingItem({ id: "item_milk", name: "Milk", cartOwner: anaRef });
const eggs = shoppingItem({ id: "item_eggs", name: "Eggs", addedAt: "2026-11-18T10:01:00.000Z", cartOwner: anaRef });
const bread = shoppingItem({ id: "item_bread", name: "Bread", addedAt: "2026-11-18T10:02:00.000Z" });
const rice = shoppingItem({ id: "item_rice", name: "Rice", addedAt: "2026-11-18T10:03:00.000Z", cartOwner: brunoRef });

/** The cart bar's button, described by the count next to it (the reminder has one too). */
const THE_BAR = { name: "Finish shopping", description: /in your cart$/ };

/** The names on the list, in order. */
function namesOnTheList() {
  const list = screen.queryByRole("list", { name: "Shopping" });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.firstElementChild?.firstElementChild?.textContent);
}

/**
 * Serves `items` as the API would: finishing takes Ana's cart off the list, and undoing puts it
 * back. Records the bodies of every finish and undo.
 */
function serveFinish(items: ShoppingItemView[]) {
  const finishes: unknown[] = [];
  const undos: unknown[] = [];
  let current = items;
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    http.get("*/api/household/shopping", () => HttpResponse.json({ items: current, lastCategoryId: null })),
    http.post("*/api/household/shopping/finish", async ({ request }) => {
      finishes.push(await request.json());
      current = current.filter((item) => item.cartOwner?.userId !== anaRef.userId);
      return HttpResponse.json({ expense: null });
    }),
    http.post("*/api/household/shopping/finish/undo", async ({ request }) => {
      const body = (await request.json()) as { itemIds: string[] };
      undos.push(body);
      const back = items.filter((item) => body.itemIds.includes(item.id));
      current = items.filter((item) => back.includes(item) || current.includes(item));
      return HttpResponse.json({ items: back });
    }),
  );
  return { finishes, undos };
}

async function finishWithoutAnExpense() {
  await userEvent.click(await screen.findByRole("button", THE_BAR));
  const dialog = await screen.findByRole("dialog", { name: "Done shopping?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Finish without an expense" }));
}

describe("the cart bar", () => {
  it("says how many things are in the viewer's cart, only theirs, and leads to finishing", async () => {
    serveFinish([milk, eggs, bread, rice]);
    renderApp({ path: "/shopping" });

    const finish = await screen.findByRole("button", THE_BAR);
    expect(finish).toHaveAccessibleDescription("2 in your cart");
  });

  it("isn't there while the viewer's cart is empty, nor for guests", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.shopping([bread, rice]));
    const { unmount } = renderApp({ path: "/shopping" });
    await screen.findByText("Bread");
    expect(screen.queryByRole("button", THE_BAR)).not.toBeInTheDocument();
    unmount();

    server.use(handlers.household(homeView({ myRole: "GUEST" })), handlers.shopping([milk, bread]));
    renderApp({ path: "/shopping" });
    await screen.findByText("Bread");
    expect(screen.queryByRole("button", THE_BAR)).not.toBeInTheDocument();
  });

  it("follows the cart: one more tap, one more in the count", async () => {
    serveFinish([milk, bread]);
    server.use(
      http.put("*/api/household/shopping/items/:id/cart", () =>
        HttpResponse.json({ item: { ...bread, cartOwner: anaRef } }),
      ),
    );
    renderApp({ path: "/shopping" });
    expect(await screen.findByRole("button", THE_BAR)).toHaveAccessibleDescription("1 in your cart");

    await userEvent.click(screen.getByRole("checkbox", { name: "Put Bread in your cart" }));

    expect(screen.getByRole("button", THE_BAR)).toHaveAccessibleDescription("2 in your cart");
  });
});

describe("finishing without an expense", () => {
  it("explains what happens before anything changes", async () => {
    const { finishes } = serveFinish([milk, eggs, bread]);
    renderApp({ path: "/shopping" });

    await userEvent.click(await screen.findByRole("button", THE_BAR));

    const dialog = await screen.findByRole("dialog", { name: "Done shopping?" });
    expect(dialog).toHaveAccessibleDescription(
      "The 2 things in your cart leave the list. What you didn't find stays on it.",
    );
    expect(within(dialog).getByRole("button", { name: "Finish without an expense" })).toHaveAccessibleDescription(
      "For when someone else paid or it isn't shared.",
    );
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(finishes).toEqual([]);
    expect(namesOnTheList()).toEqual(["Milk", "Eggs", "Bread"]);
  });

  it("takes the cart off the list at once, keeps what wasn't found, and offers to undo", async () => {
    const { finishes } = serveFinish([milk, eggs, bread, rice]);
    renderApp({ path: "/shopping" });

    await finishWithoutAnExpense();

    const toast = await screen.findByRole("alertdialog", { name: "Done: 2 things off the list" });
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(finishes).toEqual([{ itemIds: ["item_milk", "item_eggs"], expense: null }]);
    expect(namesOnTheList()).toEqual(["Bread", "Rice"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", THE_BAR)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "What's needed?" })).toHaveFocus());
  });

  it("says one thing for a cart of one", async () => {
    serveFinish([milk, bread]);
    renderApp({ path: "/shopping" });
    await userEvent.click(await screen.findByRole("button", THE_BAR));
    expect(await screen.findByRole("dialog", { name: "Done shopping?" })).toHaveAccessibleDescription(
      "The 1 thing in your cart leaves the list. What you didn't find stays on it.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Finish without an expense" }));
    expect(await screen.findByRole("alertdialog", { name: "Done: 1 thing off the list" })).toBeInTheDocument();
  });

  it("puts the items back in the cart with Undo, and says so", async () => {
    const { undos } = serveFinish([milk, eggs, bread]);
    renderApp({ path: "/shopping" });
    await finishWithoutAnExpense();
    const toast = await screen.findByRole("alertdialog", { name: "Done: 2 things off the list" });

    await userEvent.click(within(toast).getByRole("button", { name: "Undo" }));

    expect(await screen.findByText("2 things are back in your cart")).toHaveAttribute("role", "status");
    expect(undos).toEqual([{ itemIds: ["item_milk", "item_eggs"] }]);
    await waitFor(() => expect(namesOnTheList()).toEqual(["Milk", "Eggs", "Bread"]));
    expect(screen.getByRole("checkbox", { name: "Take Milk out of your cart" })).toBeChecked();
    expect(screen.getByRole("button", THE_BAR)).toBeInTheDocument();
  });

  it("explains when it is too late to undo, or the same thing is on the list again", async () => {
    serveFinish([milk, eggs, bread]);
    server.use(http.post("*/api/household/shopping/finish/undo", () => apiError(410, "shopping.undo.expired")));
    renderApp({ path: "/shopping" });
    await finishWithoutAnExpense();

    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("It's too late to undo that.");
    expect(namesOnTheList()).toEqual(["Bread"]);
  });

  it("puts the cart back and says why when it changed on another device meanwhile", async () => {
    serveFinish([milk, eggs, bread]);
    server.use(
      http.post("*/api/household/shopping/finish", () => {
        // Ana took Eggs out of her cart on her phone a moment earlier.
        server.use(handlers.shopping([milk, { ...eggs, cartOwner: null }, bread]));
        return apiError(409, "shopping.cart.changed");
      }),
    );
    renderApp({ path: "/shopping" });

    await finishWithoutAnExpense();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your cart changed meanwhile. Check what's in it and finish again.",
    );
    await waitFor(() => expect(screen.getByRole("button", THE_BAR)).toHaveAccessibleDescription("1 in your cart"));
    expect(namesOnTheList()).toEqual(["Milk", "Eggs", "Bread"]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("can't start offline: the bar's button is off, with the reason", async () => {
    const storage = new MemoryStorage();
    serveFinish([milk, bread]);
    renderApp({ path: "/shopping", storage, installed: true });
    const finish = await screen.findByRole("button", THE_BAR);

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => expect(finish).toBeDisabled());
  });

  it("has no accessibility violations with the bar, the dialog and the toast", async () => {
    serveFinish([milk, eggs, bread]);
    const { container } = renderApp({ path: "/shopping" });
    await screen.findByRole("button", THE_BAR);
    await expectNoA11yViolations(container);
    await userEvent.click(screen.getByRole("button", THE_BAR));
    await screen.findByRole("dialog");
    await expectNoA11yViolations(container.ownerDocument.body);
    await userEvent.click(screen.getByRole("button", { name: "Finish without an expense" }));
    await screen.findByRole("alertdialog");
    await expectNoA11yViolations(container.ownerDocument.body);
  });
});

describe("a forgotten cart", () => {
  it("reminds its owner at the top of the list, with a way to finish", async () => {
    serveFinish([milk, eggs, bread]);
    renderApp({ path: "/shopping" });

    const reminder = await screen.findByText("You still have 2 in your cart");
    const finish = within(reminder.closest("[role=status]") as HTMLElement).getByRole("button", {
      name: "Finish shopping",
    });
    await userEvent.click(finish);
    expect(await screen.findByRole("dialog", { name: "Done shopping?" })).toBeInTheDocument();
  });

  it("isn't a reminder for a cart filled during this visit", async () => {
    serveFinish([bread]);
    server.use(
      http.put("*/api/household/shopping/items/:id/cart", () =>
        HttpResponse.json({ item: { ...bread, cartOwner: anaRef } }),
      ),
    );
    renderApp({ path: "/shopping" });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Put Bread in your cart" }));

    expect(await screen.findByRole("button", THE_BAR)).toBeInTheDocument();
    expect(screen.queryByText(/You still have/)).not.toBeInTheDocument();
  });
});
