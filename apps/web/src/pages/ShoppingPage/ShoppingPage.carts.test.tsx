import type { ShoppingItemView } from "@hogar/shared";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { fakeHouseholdEvents } from "../../test/fakeHouseholdEvents";
import { renderApp } from "../../test/renderApp";
import { anaRef, apiError, brunoRef, handlers, homeView, server, shoppingItem } from "../../test/server";

const milk = shoppingItem({ id: "item_milk", name: "Milk", note: "lactose-free" });
const eggs = shoppingItem({ id: "item_eggs", name: "Eggs", addedAt: "2026-11-18T10:01:00.000Z" });

/** The row of the item called `name`. */
async function rowOf(name: string) {
  const list = await screen.findByRole("list", { name: "Shopping" });
  const row = within(list)
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name, { exact: true }));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

/**
 * Serves `items` as a live server would: putting one in the cart or taking it out changes what the
 * next read returns. Records each move as "PUT item_milk" or "DELETE item_milk".
 */
function serveCarts(items: ShoppingItemView[]) {
  const moves: string[] = [];
  let current = items;
  const move = (id: string, cartOwner: ShoppingItemView["cartOwner"]) => {
    current = current.map((item) => (item.id === id ? { ...item, cartOwner } : item));
    return HttpResponse.json({ item: current.find((item) => item.id === id) });
  };
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    http.get("*/api/household/shopping", () => HttpResponse.json({ items: current, lastCategoryId: null })),
    http.put("*/api/household/shopping/items/:id/cart", ({ params }) => {
      moves.push(`PUT ${String(params["id"])}`);
      return move(String(params["id"]), anaRef);
    }),
    http.delete("*/api/household/shopping/items/:id/cart", ({ params }) => {
      moves.push(`DELETE ${String(params["id"])}`);
      return move(String(params["id"]), null);
    }),
  );
  return { moves };
}

describe("carts", () => {
  it("puts an item in the person's cart with one tap, marked in its place", async () => {
    const { moves } = serveCarts([milk, eggs]);
    renderApp({ path: "/shopping" });

    const check = await screen.findByRole("checkbox", { name: "Put Milk in your cart" });
    expect(check).not.toBeChecked();
    await userEvent.click(check);

    expect(await screen.findByRole("checkbox", { name: "Take Milk out of your cart" })).toBeChecked();
    expect(within(await rowOf("Milk")).getByText("In your cart")).toBeInTheDocument();
    expect(within(await rowOf("Eggs")).queryByText("In your cart")).not.toBeInTheDocument();
    expect(moves).toEqual(["PUT item_milk"]);
  });

  it("takes an item out of the person's cart, back on the list", async () => {
    const { moves } = serveCarts([{ ...milk, cartOwner: anaRef }, eggs]);
    renderApp({ path: "/shopping" });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Take Milk out of your cart" }));

    expect(await screen.findByRole("checkbox", { name: "Put Milk in your cart" })).not.toBeChecked();
    expect(screen.queryByText("In your cart")).not.toBeInTheDocument();
    expect(moves).toEqual(["DELETE item_milk"]);
  });

  it("shows whose cart an item is in, and locks it for everyone else, saying why", async () => {
    serveCarts([{ ...milk, cartOwner: brunoRef }, eggs]);
    renderApp({ path: "/shopping" });

    const row = await rowOf("Milk");
    expect(within(row).getByText("In Bruno Díaz's cart")).toBeInTheDocument();
    const check = within(row).getByRole("checkbox", { name: "Put Milk in your cart" });
    expect(check).toBeDisabled();
    expect(check).not.toBeChecked();
    expect(check).toHaveAccessibleDescription("In Bruno Díaz's cart");

    const options = within(row).getByRole("button", { name: "Options for Milk" });
    expect(options).toHaveAccessibleDescription("In Bruno Díaz's cart");
    await userEvent.click(options);
    for (const action of ["Edit", "Delete"]) {
      const item = await screen.findByRole("menuitem", { name: action });
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveAccessibleDescription("Only Bruno Díaz can change it while it's in their cart.");
    }
  });

  it("moves the item back and says why when someone else got there first", async () => {
    serveCarts([milk, eggs]);
    server.use(
      http.put("*/api/household/shopping/items/:id/cart", () => {
        // Bruno tapped Milk a moment earlier.
        server.use(handlers.shopping([{ ...milk, cartOwner: brunoRef }, eggs]));
        return apiError(409, "shopping.item.in_cart");
      }),
    );
    renderApp({ path: "/shopping" });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Put Milk in your cart" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "It's in someone else's cart now, so only they can change it.",
    );
    expect(await within(await rowOf("Milk")).findByText("In Bruno Díaz's cart")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Put Milk in your cart" })).toBeDisabled();
    expect(screen.queryByText("In your cart")).not.toBeInTheDocument();
  });

  it("shows an item someone else takes into their cart as soon as the household announces it", async () => {
    const events = fakeHouseholdEvents();
    serveCarts([milk, eggs]);
    renderApp({ path: "/shopping", householdEvents: events });
    await rowOf("Milk");

    // Bruno, in the shop, takes Milk: the API now lists it in his cart and says the list changed.
    server.use(handlers.shopping([{ ...milk, cartOwner: brunoRef }, eggs]));
    act(() => events.emit("shopping:changed"));

    expect(await within(await rowOf("Milk")).findByText("In Bruno Díaz's cart")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Put Milk in your cart" })).toBeDisabled();
  });

  it("lets guests see every cart, without checks of their own", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ myRole: "GUEST" })),
      handlers.shopping([{ ...milk, cartOwner: brunoRef }, eggs]),
    );
    const { container } = renderApp({ path: "/shopping" });

    expect(within(await rowOf("Milk")).getByText("In Bruno Díaz's cart")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("has no accessibility violations with items in carts", async () => {
    serveCarts([
      { ...milk, cartOwner: anaRef },
      { ...eggs, cartOwner: brunoRef },
    ]);
    const { container } = renderApp({ path: "/shopping" });
    await screen.findByText("In Bruno Díaz's cart");
    await waitFor(() => expect(screen.getByText("In your cart")).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });

  it("explains an edit refused because the item went into someone else's cart meanwhile", async () => {
    serveCarts([milk, eggs]);
    server.use(
      http.patch("*/api/household/shopping/items/:id", () => {
        server.use(handlers.shopping([{ ...milk, cartOwner: brunoRef }, eggs]));
        return apiError(409, "shopping.item.in_cart");
      }),
    );
    renderApp({ path: "/shopping" });
    await userEvent.click(await screen.findByRole("button", { name: "Options for Milk" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit “Milk”" });

    await userEvent.type(within(dialog).getByRole("textbox", { name: "Note (optional)" }), " please");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "It's in someone else's cart now, so only they can change it.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await within(await rowOf("Milk")).findByText("In Bruno Díaz's cart")).toBeInTheDocument();
  });

  it("doesn't offer the person's note to an item in someone else's cart, which only they can change", async () => {
    serveCarts([{ ...milk, note: null, cartOwner: brunoRef }]);
    server.use(http.post("*/api/household/shopping/items", () => apiError(409, "shopping.item.duplicate")));
    renderApp({ path: "/shopping" });

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "milk");
    await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), "oat{Enter}");

    expect(await screen.findByText("Milk is already on the list.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use my note" })).not.toBeInTheDocument();
  });

  it("still offers it for an item in the person's own cart", async () => {
    serveCarts([{ ...milk, note: null, cartOwner: anaRef }]);
    server.use(http.post("*/api/household/shopping/items", () => apiError(409, "shopping.item.duplicate")));
    renderApp({ path: "/shopping" });

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "milk");
    await userEvent.type(screen.getByRole("textbox", { name: "Note (optional)" }), "oat{Enter}");

    expect(await screen.findByRole("button", { name: "Use my note" })).toBeInTheDocument();
  });
});

describe("becoming a guest while shopping", () => {
  const notice = "You have guest access now, so your cart went back to the list.";

  /**
   * Ana, a member, with `items` on the list. `demote` makes her a guest the way the API does: the
   * role and the emptied cart change together, and the household is told. With `listFirst`, the
   * list's re-read arrives before the household's.
   */
  async function shopAs(items: ShoppingItemView[]) {
    const events = fakeHouseholdEvents();
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: "MEMBER" })), handlers.shopping(items));
    renderApp({ path: "/shopping", householdEvents: events });
    await rowOf("Milk");
    act(() => events.connect());
    return {
      events,
      demote: ({ listFirst = false } = {}) => {
        server.use(
          http.get("*/api/household", async () => {
            if (listFirst) await delay(50);
            return HttpResponse.json({ household: homeView({ myRole: "GUEST" }) });
          }),
          handlers.shopping(items.map((item) => ({ ...item, cartOwner: null }))),
        );
        act(() => {
          events.emit("household:changed");
          events.emit("shopping:changed");
        });
      },
    };
  }

  it("says the cart went back to the list", async () => {
    const { demote } = await shopAs([{ ...milk, cartOwner: anaRef }, eggs]);

    demote();

    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(await screen.findByText("As a guest you can see the list but not change it.")).toBeInTheDocument();
    expect(screen.queryByText("In your cart")).not.toBeInTheDocument();
  });

  it("says it too when the list arrives before the new role", async () => {
    const { demote } = await shopAs([{ ...milk, cartOwner: anaRef }, eggs]);

    demote({ listFirst: true });

    expect(await screen.findByText(notice)).toBeInTheDocument();
  });

  it("says nothing when the cart was empty", async () => {
    const { demote } = await shopAs([milk, eggs]);

    demote();

    expect(await screen.findByText("As a guest you can see the list but not change it.")).toBeInTheDocument();
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });

  it("says nothing when the person had already emptied their cart themselves", async () => {
    serveCarts([{ ...milk, cartOwner: anaRef }, eggs]);
    server.use(handlers.household(homeView({ myRole: "MEMBER" })));
    const events = fakeHouseholdEvents();
    renderApp({ path: "/shopping", householdEvents: events });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Take Milk out of your cart" }));
    await screen.findByRole("checkbox", { name: "Put Milk in your cart" });
    act(() => events.connect());
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Put Milk in your cart" })).toBeEnabled());

    server.use(handlers.household(homeView({ myRole: "GUEST" })));
    act(() => events.emit("household:changed"));

    expect(await screen.findByText("As a guest you can see the list but not change it.")).toBeInTheDocument();
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });
});
