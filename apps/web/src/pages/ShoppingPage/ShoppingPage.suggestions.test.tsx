import type { ShoppingSuggestion } from "@hogar/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { MemoryStorage } from "../../test/memoryStorage";
import { renderApp } from "../../test/renderApp";
import { anaRef, handlers, homeView, server, shoppingItem } from "../../test/server";

/** What Ana's household bought before, the most bought first, as the server orders it. */
const bought: ShoppingSuggestion[] = [
  { name: "Leche", note: "Sin lactosa", timesBought: 9 },
  { name: "Lechuga", note: null, timesBought: 1 },
  { name: "Pan", note: null, timesBought: 4 },
];

/** Ana on the list; `added` captures what the form posts, and the list read after it shows it. */
function shoppingWithSuggestions(added: { body?: unknown } = {}) {
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    handlers.shopping([]),
    handlers.suggestions(bought),
    http.post("*/api/household/shopping/items", async ({ request }) => {
      added.body = await request.json();
      const { name, note } = added.body as { name: string; note: string | null };
      const item = shoppingItem({ id: "item_new", name, note, askedBy: anaRef });
      server.use(handlers.shopping([item]));
      return HttpResponse.json({ item }, { status: 201 });
    }),
  );
}

const optionTexts = () => screen.getAllByRole("option").map((option) => option.textContent);

describe("suggestions while adding", () => {
  it("suggests what the household bought, how often and with its last note, and fills both fields", async () => {
    const added: { body?: unknown } = {};
    shoppingWithSuggestions(added);
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "lec");

    await screen.findByRole("listbox");
    expect(optionTexts()).toEqual(["Leche, Sin lactosa · Bought 9 times", "Lechuga, Bought once"]);
    await userEvent.click(screen.getByRole("option", { name: /^Leche,/ }));

    const note = screen.getByRole("textbox", { name: "Note (optional)" });
    expect(name).toHaveValue("Leche");
    expect(note).toHaveValue("Sin lactosa");

    // Both stay editable before adding.
    await userEvent.type(name, " entera");
    await userEvent.clear(note);
    await userEvent.type(note, "2 litros");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("You added Leche entera")).toBeInTheDocument();
    expect(added.body).toEqual({ name: "Leche entera", note: "2 litros" });
  });

  it("is used with the keyboard alone: arrows and Enter pick a suggestion, then Enter adds it", async () => {
    const added: { body?: unknown } = {};
    shoppingWithSuggestions(added);
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "le");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(name).toHaveValue("Leche");
    expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue("Sin lactosa");
    expect(added.body).toBeUndefined();

    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("You added Leche")).toBeInTheDocument();
    expect(added.body).toEqual({ name: "Leche", note: "Sin lactosa" });
    expect(name).toHaveValue("");
    expect(name).toHaveFocus();
  });

  it("adds what was typed with Enter even while suggestions show", async () => {
    const added: { body?: unknown } = {};
    shoppingWithSuggestions(added);
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "Lech");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("You added Lech")).toBeInTheDocument();
    expect(added.body).toEqual({ name: "Lech", note: null });
  });

  it("leaves out what is already on the list, even before the server knows", async () => {
    shoppingWithSuggestions();
    server.use(handlers.shopping([shoppingItem({ name: "LECHE " })]));
    renderApp({ path: "/shopping" });
    await screen.findByText("LECHE");

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "lec");

    await screen.findByRole("listbox");
    expect(optionTexts()).toEqual(["Lechuga, Bought once"]);
  });

  it("shows nothing while nothing matches, and the field keeps what was typed", async () => {
    shoppingWithSuggestions();
    renderApp({ path: "/shopping" });

    const name = await screen.findByRole("combobox", { name: "What's needed?" });
    await userEvent.type(name, "kiwis");
    await userEvent.tab();

    expect(name).toHaveValue("kiwis");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("says how often in Spanish", async () => {
    shoppingWithSuggestions();
    renderApp({ path: "/shopping", locale: "es" });

    await userEvent.type(await screen.findByRole("combobox", { name: "¿Qué hace falta?" }), "lec");

    await screen.findByRole("listbox");
    expect(optionTexts()).toEqual(["Leche, Sin lactosa · Comprado 9 veces", "Lechuga, Comprado una vez"]);
  });

  it("keeps suggestions out of what the installed app saves", async () => {
    const storage = new MemoryStorage();
    shoppingWithSuggestions();
    server.use(handlers.shopping([shoppingItem()]));
    renderApp({ path: "/shopping", storage, installed: true });

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "lec");
    await screen.findByRole("listbox");

    await waitFor(() => expect(storage.contents()).toContain("item_milk"), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(storage.contents()).not.toContain("Lechuga");
  });

  it("has no accessibility violations with suggestions open", async () => {
    shoppingWithSuggestions();
    const { container } = renderApp({ path: "/shopping" });

    await userEvent.type(await screen.findByRole("combobox", { name: "What's needed?" }), "lec");
    const listbox = await screen.findByRole("listbox");

    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    // The popover itself is checked in packages/ui (portaled to <body>, it sits outside the page landmarks).
    await expectNoA11yViolations(container);
  });
});
