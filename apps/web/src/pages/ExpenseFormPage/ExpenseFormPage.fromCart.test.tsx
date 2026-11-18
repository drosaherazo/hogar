import type { ExpenseView, ShoppingItemView } from "@hogar/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { localToday } from "../../i18n/format";
import { expectNoA11yViolations } from "../../test/axe";
import { fakeHouseholdEvents } from "../../test/fakeHouseholdEvents";
import { renderApp } from "../../test/renderApp";
import {
  ana,
  anaRef,
  apiError,
  brunoRef,
  expenseView,
  handlers,
  homeView,
  server,
  shoppingItem,
} from "../../test/server";

const milk = shoppingItem({ id: "item_milk", name: "milk", note: "oat", cartOwner: anaRef });
const eggs = shoppingItem({ id: "item_eggs", name: "eggs", addedAt: "2026-11-18T10:01:00.000Z", cartOwner: anaRef });
const bread = shoppingItem({ id: "item_bread", name: "bread", addedAt: "2026-11-18T10:02:00.000Z" });
const rice = shoppingItem({ id: "item_rice", name: "rice", addedAt: "2026-11-18T10:03:00.000Z", cartOwner: brunoRef });

const PATH = "/shopping/finish";

/**
 * Serves the list (`items`, with Groceries as the last purchase's category) and records every
 * finish, answering it with the expense the API would create and serving that expense after.
 */
function serveCart(initial: ShoppingItemView[], { lastCategoryId = "cat_groceries" as string | null } = {}) {
  const finishes: unknown[] = [];
  let items = initial;
  let saved: ExpenseView | null = null;
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    http.get("*/api/household/shopping", () => HttpResponse.json({ items, lastCategoryId })),
    http.post("*/api/household/shopping/finish", async ({ request }) => {
      const body = (await request.json()) as { itemIds: string[]; expense: { description: string } };
      finishes.push(body);
      const bought = items.filter((item) => body.itemIds.includes(item.id));
      items = items.filter((item) => !body.itemIds.includes(item.id));
      saved = expenseView({
        id: "expense_shop",
        description: body.expense.description,
        boughtItems: bought.map(({ name, note }) => ({ name, note })),
      });
      return HttpResponse.json({ expense: saved }, { status: 201 });
    }),
    http.get("*/api/household/expenses/:id", () => HttpResponse.json({ expense: saved })),
  );
  return {
    finishes,
    /** The cart changes on the person's other device. */
    setItems: (next: ShoppingItemView[]) => {
      items = next;
    },
  };
}

/** "What you bought", in order. */
function whatYouBought() {
  return within(screen.getByRole("list", { name: "What you bought" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("noting what I paid, from the finish dialog", () => {
  it("is the main choice, with its hint, and opens the expense form for the cart", async () => {
    serveCart([milk, eggs, bread]);
    renderApp({ path: "/shopping" });

    await userEvent.click(await screen.findByRole("button", { name: "Finish shopping", description: /in your cart$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Done shopping?" });
    const record = within(dialog).getByRole("button", { name: "Note what I paid" });
    expect(record).toHaveAccessibleDescription("Opens the expense with what you bought, to split it like any other.");
    await userEvent.click(record);

    expect(await screen.findByRole("heading", { level: 1, name: "Add an expense" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "What you bought" })).toBeInTheDocument();
  });
});

describe("the expense form, from the cart", () => {
  it("starts filled in: a title from the items, me as the payer, today, the last purchase's category and what I bought", async () => {
    serveCart([milk, eggs, bread, rice]);
    renderApp({ path: PATH });

    expect(await screen.findByRole("textbox", { name: "What was it?" })).toHaveValue("Milk and eggs");
    expect(screen.getByRole("combobox", { name: "Who paid?" })).toHaveValue(ana.id);
    expect(screen.getByLabelText("Date")).toHaveValue(localToday());
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("cat_groceries"));
    expect(whatYouBought()).toEqual(["milkoat", "eggs"]);
  });

  it("records the expense with what was bought, then shows it with what was bought", async () => {
    const { finishes } = serveCart([milk, eggs, bread]);
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "24");

    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Milk and eggs" })).toBeInTheDocument();
    expect(finishes).toEqual([
      {
        itemIds: ["item_milk", "item_eggs"],
        expense: {
          description: "Milk and eggs",
          amountCents: 2400,
          currency: "EUR",
          paidById: ana.id,
          date: localToday(),
          categoryId: "cat_groceries",
          split: {
            method: "WEIGHTS",
            previewShares: [
              { userId: ana.id, amountCents: 1800 },
              { userId: brunoRef.userId, amountCents: 600 },
            ],
          },
        },
      },
    ]);
    const bought = screen.getByRole("list", { name: "What was bought" });
    expect(
      within(bought)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["milkoat", "eggs"]);
  });

  it("follows the cart live, rewriting the title until I edit it", async () => {
    const events = fakeHouseholdEvents();
    const { setItems } = serveCart([milk, eggs, bread]);
    renderApp({ path: PATH, householdEvents: events });
    const title = await screen.findByRole("textbox", { name: "What was it?" });
    act(() => events.connect());

    setItems([milk, eggs, { ...bread, cartOwner: anaRef }]);
    act(() => events.emit("shopping:changed"));
    await waitFor(() => expect(title).toHaveValue("Milk, eggs, and bread"));
    expect(whatYouBought()).toEqual(["milkoat", "eggs", "bread"]);

    await userEvent.clear(title);
    await userEvent.type(title, "The weekly shop");
    setItems([milk, eggs, bread]);
    act(() => events.emit("shopping:changed"));
    await waitFor(() => expect(whatYouBought()).toEqual(["milkoat", "eggs"]));
    expect(title).toHaveValue("The weekly shop");
  });

  it("asks to check what I bought when the cart changed on another device, then saves what I saw", async () => {
    const events = fakeHouseholdEvents();
    const { finishes, setItems } = serveCart([milk, eggs, bread]);
    renderApp({ path: PATH, householdEvents: events });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "24");

    // The other device takes eggs out before the form hears about it: the server refuses.
    setItems([milk, { ...eggs, cartOwner: null }, bread]);
    server.use(
      http.post("*/api/household/shopping/finish", () => apiError(409, "shopping.cart.changed"), { once: true }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByText("Your cart changed. Check what you bought before saving.")).toBeInTheDocument();
    await waitFor(() => expect(whatYouBought()).toEqual(["milkoat"]));
    expect(screen.getByRole("textbox", { name: "What was it?" })).toHaveValue("Milk");
    expect(finishes).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("heading", { level: 1, name: "Milk" });
    expect(finishes).toEqual([expect.objectContaining({ itemIds: ["item_milk"] })]);
  });

  it("asks to check what I bought before saving when the cart changes while the form is open", async () => {
    const events = fakeHouseholdEvents();
    const { finishes, setItems } = serveCart([milk, eggs, bread]);
    renderApp({ path: PATH, householdEvents: events });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "24");
    act(() => events.connect());

    setItems([milk, { ...eggs, cartOwner: null }, bread]);
    act(() => events.emit("shopping:changed"));

    expect(await screen.findByText("Your cart changed. Check what you bought before saving.")).toBeInTheDocument();
    expect(whatYouBought()).toEqual(["milkoat"]);
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(finishes).toEqual([expect.objectContaining({ itemIds: ["item_milk"] })]));
  });

  it("leaves the cart as it was when cancelled", async () => {
    const { finishes } = serveCart([milk, eggs, bread]);
    renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("link", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Shopping" })).toBeInTheDocument();
    expect(finishes).toEqual([]);
    expect(
      await screen.findByRole("button", { name: "Finish shopping", description: /in your cart$/ }),
    ).toBeInTheDocument();
  });

  it("goes back to the list when there is nothing in my cart to note", async () => {
    serveCart([bread, rice]);
    renderApp({ path: PATH });
    expect(await screen.findByRole("heading", { level: 1, name: "Shopping" })).toBeInTheDocument();
  });

  it("starts without a category when the household has no last purchase", async () => {
    serveCart([milk], { lastCategoryId: null });
    renderApp({ path: PATH });
    await screen.findByRole("list", { name: "What you bought" });
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("");
  });

  it("titles the purchase in Spanish", async () => {
    serveCart([milk, eggs, { ...bread, cartOwner: anaRef }]);
    renderApp({ path: PATH, locale: "es" });
    expect(await screen.findByRole("textbox", { name: "¿Qué fue?" })).toHaveValue("Milk, eggs y bread");
    expect(screen.getByRole("list", { name: "Lo que compraste" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    serveCart([milk, eggs]);
    const { container } = renderApp({ path: PATH });
    await screen.findByRole("list", { name: "What you bought" });
    await expectNoA11yViolations(container);
  });
});
