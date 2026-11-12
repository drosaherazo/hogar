import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { localToday } from "../../i18n/format";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import {
  ana,
  anaRef,
  apiError,
  brunoRef,
  categoryView,
  expenseView,
  handlers,
  homeView,
  member,
  server,
} from "../../test/server";

const PATH = "/expenses/new";

describe("ExpenseFormPage (adding)", () => {
  it("starts with me as the payer, today's date and the household's split", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: PATH });

    expect(await screen.findByRole("heading", { name: "Add an expense" })).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Who paid?" })).toHaveValue(ana.id);
    const date = screen.getByLabelText("Date");
    expect(date).toHaveValue(localToday());
    expect(date).toHaveAttribute("max", localToday());
    const weights = screen.getByRole("radio", { name: "The household's split" });
    expect(weights).toBeChecked();
    expect(weights).toHaveAccessibleDescription("Ana García 75% and Bruno Díaz 25%");
  });

  it("previews each person's share while the amount is typed", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "42.80");

    const preview = screen.getByRole("list", { name: "Each person's share" });
    const rows = within(preview).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€32.10");
    expect(rows[1]).toHaveTextContent("Bruno Díaz€10.70");
  });

  it("reads amounts typed the Spanish way and opens the new expense", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/expenses", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ expense: expenseView({ id: "new_one" }) }, { status: 201 });
      }),
      handlers.expense(expenseView({ id: "new_one" })),
    );
    const { router } = renderApp({ path: PATH, locale: "es" });

    await userEvent.type(await screen.findByRole("textbox", { name: "¿Qué fue?" }), "Compra");
    await userEvent.type(screen.getByRole("textbox", { name: "Importe (€)" }), "42,80");
    await userEvent.click(screen.getByRole("button", { name: "Guardar gasto" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Gasto guardado.");
    expect(router.state.location.pathname).toBe("/expenses/new_one");
    expect(body).toEqual({
      description: "Compra",
      amountCents: 4280,
      paidById: ana.id,
      date: localToday(),
      split: {
        method: "WEIGHTS",
        previewShares: [
          { userId: ana.id, amountCents: 3210 },
          { userId: "user_m_bruno", amountCents: 1070 },
        ],
      },
      categoryId: null,
    });
  });

  it("shows the new shares when the split changed before saving, and saves them on the next try", async () => {
    const bodies: unknown[] = [];
    let even = false;
    server.use(
      handlers.signedIn(),
      http.get("*/api/household", () =>
        HttpResponse.json({
          household: even
            ? homeView({
                members: [
                  member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 1, shareBps: 5000 }),
                  member({ id: "m_bruno", name: "Bruno Díaz", weight: 1, shareBps: 5000 }),
                ],
              })
            : homeView(),
        }),
      ),
      http.post("*/api/household/expenses", async ({ request }) => {
        bodies.push(await request.json());
        if (bodies.length === 1) {
          even = true;
          return apiError(409, "expense.split.changed");
        }
        return HttpResponse.json({ expense: expenseView({ id: "new_one" }) }, { status: 201 });
      }),
      handlers.expense(expenseView({ id: "new_one" })),
    );
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Groceries");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), "42.80");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The split changed while you were editing.");
    const preview = screen.getByRole("list", { name: "Each person's share" });
    expect(await within(preview).findAllByText("€21.40")).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "What was it?" })).toHaveValue("Groceries");

    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Expense saved.");
    expect(bodies[1]).toEqual(
      expect.objectContaining({
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 2140 },
            { userId: "user_m_bruno", amountCents: 2140 },
          ],
        },
      }),
    );
  });

  it("explains what's missing next to each field, without sending anything", async () => {
    let posted = false;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/expenses", () => {
        posted = true;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    renderApp({ path: PATH });
    await userEvent.click(await screen.findByRole("button", { name: "Save expense" }));

    expect(screen.getByRole("textbox", { name: "What was it?" })).toHaveAccessibleDescription(
      expect.stringContaining("Say what it was"),
    );
    expect(screen.getByRole("textbox", { name: "Amount (€)" })).toHaveAccessibleDescription(
      expect.stringContaining("Enter an amount from €0.01"),
    );
    expect(posted).toBe(false);
  });

  it("refuses amounts written with thousands separators", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "1,200.50");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(screen.getByRole("textbox", { name: "Amount (€)" })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows what the server says when it refuses", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/expenses", () => apiError(400, "expense.person.not_member")),
    );
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Groceries");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), "42.80");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone in this expense is no longer part of the household",
    );
  });

  it("explains when nobody pays in the household's split, with a way to fix it", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(
        homeView({
          members: [
            member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 0, shareBps: 0 }),
            member({ id: "m_bruno", name: "Bruno Díaz", weight: 0, shareBps: 0 }),
          ],
        }),
      ),
    );
    renderApp({ path: PATH });
    const weights = await screen.findByRole("radio", { name: "The household's split" });
    expect(weights).toBeDisabled();
    expect(weights).toHaveAccessibleDescription(expect.stringContaining("Nobody pays in the household's split yet"));
    expect(screen.getByRole("link", { name: "Review the split" })).toHaveAttribute("href", "/household/settings#split");
  });

  it("sends guests back to the expenses", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ myRole: "GUEST" })),
      handlers.activity({ items: [], nextCursor: null }),
    );
    const { router } = renderApp({ path: PATH });
    await screen.findByRole("heading", { name: "Expenses" });
    expect(router.state.location.pathname).toBe("/expenses");
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { container } = renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "Amount (€)" }), "42.80");
    await expectNoA11yViolations(container);
  });
});

describe("ExpenseFormPage › other ways to split", () => {
  const bruno = "user_m_bruno";

  /** Fills description and amount, and captures what would be sent. */
  async function startExpense(amount: string) {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.post("*/api/household/expenses", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ expense: expenseView() }, { status: 201 });
      }),
      handlers.expense(),
    );
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Dinner");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), amount);
    return () => body;
  }

  it("splits equally among the people chosen, showing each share", async () => {
    const sent = await startExpense("10.00");
    await userEvent.click(screen.getByRole("radio", { name: "Equally between…" }));

    const who = screen.getByRole("group", { name: "Who shares it?" });
    const anaBox = within(who).getByRole("checkbox", { name: "Ana García" });
    const brunoBox = within(who).getByRole("checkbox", { name: "Bruno Díaz" });
    expect(anaBox).toBeChecked();
    expect(brunoBox).toBeChecked();
    expect(within(who).getAllByText("€5.00")).toHaveLength(2);

    await userEvent.click(brunoBox);
    expect(within(who).getByText("€10.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(sent()).toEqual(expect.objectContaining({ split: { method: "EQUAL", userIds: [ana.id] } }));
  });

  it("asks for at least one person to share it", async () => {
    await startExpense("10.00");
    await userEvent.click(screen.getByRole("radio", { name: "Equally between…" }));
    const who = screen.getByRole("group", { name: "Who shares it?" });
    await userEvent.click(within(who).getByRole("checkbox", { name: "Ana García" }));
    await userEvent.click(within(who).getByRole("checkbox", { name: "Bruno Díaz" }));
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(screen.getByText("Choose at least one person to share it.")).toBeInTheDocument();
  });

  it("takes exact amounts and says what's left to assign until they add up", async () => {
    const sent = await startExpense("50");
    await userEvent.click(screen.getByRole("radio", { name: "Exact amounts" }));

    const amounts = screen.getByRole("group", { name: "How much each person pays" });
    await userEvent.type(within(amounts).getByRole("textbox", { name: "Bruno Díaz" }), "30");
    await userEvent.type(within(amounts).getByRole("textbox", { name: "Ana García" }), "15");
    expect(screen.getByText("€5.00 left to assign")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save expense" })).toBeDisabled();

    await userEvent.clear(within(amounts).getByRole("textbox", { name: "Ana García" }));
    await userEvent.type(within(amounts).getByRole("textbox", { name: "Ana García" }), "25");
    expect(screen.getByText("€5.00 over the total")).toBeInTheDocument();

    await userEvent.clear(within(amounts).getByRole("textbox", { name: "Ana García" }));
    await userEvent.type(within(amounts).getByRole("textbox", { name: "Ana García" }), "20");
    expect(screen.queryByText(/left to assign|over the total/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(sent()).toEqual(
      expect.objectContaining({
        amountCents: 5000,
        split: {
          method: "EXACT",
          shares: [
            { userId: ana.id, amountCents: 2000 },
            { userId: bruno, amountCents: 3000 },
          ],
        },
      }),
    );
  });

  it("starts with an equal split when nobody pays in the household's split", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(
        homeView({
          members: [
            member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 0, shareBps: 0 }),
            member({ id: "m_bruno", name: "Bruno Díaz", weight: 0, shareBps: 0 }),
          ],
        }),
      ),
    );
    renderApp({ path: PATH });
    expect(await screen.findByRole("radio", { name: "Equally between…" })).toBeChecked();
  });
});

describe("ExpenseFormPage (editing)", () => {
  const EDIT = "/expenses/expense_1/edit";
  /** The household's weights changed to 1 / 1 after the expense was saved with 3 / 1. */
  const evenNow = homeView({
    members: [
      member({ id: "m_ana", userId: ana.id, name: ana.name, role: "ADMIN", weight: 1, shareBps: 5000 }),
      member({ id: "m_bruno", name: "Bruno Díaz", weight: 1, shareBps: 5000, joinedAt: "2026-11-10T10:00:01.000Z" }),
    ],
  });

  it("starts from the saved expense, describing its split with the proportions it was added with", async () => {
    server.use(handlers.signedIn(), handlers.household(evenNow), handlers.expense());
    renderApp({ path: EDIT });

    expect(await screen.findByRole("heading", { name: "Edit expense" })).toBeInTheDocument();
    expect(await screen.findByRole("textbox", { name: "What was it?" })).toHaveValue("Groceries");
    expect(screen.getByRole("textbox", { name: "Amount (€)" })).toHaveValue("42.80");
    expect(
      screen.getByRole("radio", {
        name: "The split when it was added (Ana García 75% and Bruno Díaz 25%)",
      }),
    ).toBeChecked();
    const rows = within(screen.getByRole("list", { name: "Each person's share" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€32.10");
    expect(rows[1]).toHaveTextContent("Bruno Díaz€10.70");
  });

  it("previews the same proportions when the amount changes", async () => {
    server.use(handlers.signedIn(), handlers.household(evenNow), handlers.expense());
    renderApp({ path: EDIT });
    const amount = await screen.findByRole("textbox", { name: "Amount (€)" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "44.00");
    const rows = within(screen.getByRole("list", { name: "Each person's share" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€33.00");
    expect(rows[1]).toHaveTextContent("Bruno Díaz€11.00");
  });

  it("saves the change with the version it started from", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(evenNow),
      handlers.expense(),
      http.put("*/api/household/expenses/:id", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ expense: expenseView({ description: "Big shop", version: 2 }) });
      }),
    );
    const { router } = renderApp({ path: EDIT });
    const description = await screen.findByRole("textbox", { name: "What was it?" });
    await userEvent.clear(description);
    await userEvent.type(description, "Big shop");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Expense saved.");
    expect(router.state.location.pathname).toBe("/expenses/expense_1");
    expect(body).toEqual(
      expect.objectContaining({ description: "Big shop", amountCents: 4280, split: { method: "WEIGHTS" }, version: 1 }),
    );
  });

  it("sends the previewed shares when switching an expense to the default split", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.expense(
        expenseView({
          split: {
            method: "EQUAL",
            shares: [
              { person: anaRef, amountCents: 2140 },
              { person: brunoRef, amountCents: 2140 },
            ],
          },
        }),
      ),
      http.put("*/api/household/expenses/:id", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ expense: expenseView({ version: 2 }) });
      }),
    );
    renderApp({ path: EDIT });
    await userEvent.click(await screen.findByRole("radio", { name: "The household's split" }));
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Expense saved.");
    expect(body).toEqual(
      expect.objectContaining({
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 3210 },
            { userId: "user_m_bruno", amountCents: 1070 },
          ],
        },
      }),
    );
  });

  it("explains when someone else changed it meanwhile, and shows the latest version", async () => {
    let changed = false;
    server.use(
      handlers.signedIn(),
      handlers.household(evenNow),
      http.get("*/api/household/expenses/:id", () =>
        HttpResponse.json({
          expense: changed ? expenseView({ description: "Bruno's shop", version: 2 }) : expenseView(),
        }),
      ),
      http.put("*/api/household/expenses/:id", () => {
        changed = true;
        return apiError(409, "expense.changed");
      }),
    );
    renderApp({ path: EDIT });
    const description = await screen.findByRole("textbox", { name: "What was it?" });
    await userEvent.clear(description);
    await userEvent.type(description, "Ana's shop");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone changed this expense while you were editing it. Here's the latest version.",
    );
    expect(await screen.findByDisplayValue("Bruno's shop")).toBeInTheDocument();
  });

  it("sends guests back to the expense", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: "GUEST" })), handlers.expense());
    const { router } = renderApp({ path: EDIT });
    await screen.findByRole("heading", { name: "Groceries" });
    expect(router.state.location.pathname).toBe("/expenses/expense_1");
  });
});

describe("ExpenseFormPage › categories", () => {
  /** Rent with its own split, 1 / 1, in a household whose weights are 3 / 1. */
  const rentOwn = categoryView({
    id: "cat_rent",
    name: "Rent",
    emoji: "🏠",
    ownSplit: true,
    weights: [
      { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 5000 },
      { membershipId: "m_bruno", userId: "user_m_bruno", weight: 1, shareBps: 5000 },
    ],
  });
  const nobodyInDog = categoryView({
    id: "cat_dog",
    name: "Dog",
    emoji: "🐶",
    position: 2,
    ownSplit: true,
    weights: [
      { membershipId: "m_ana", userId: ana.id, weight: 0, shareBps: 0 },
      { membershipId: "m_bruno", userId: "user_m_bruno", weight: 0, shareBps: 0 },
    ],
  });
  const leisure = categoryView({ id: "cat_leisure", name: "Leisure", emoji: "🎉", position: 3 });

  function capture(method: "post" | "put") {
    const bodies: unknown[] = [];
    const handler = http[method](
      method === "post" ? "*/api/household/expenses" : "*/api/household/expenses/:id",
      async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ expense: expenseView({ version: 2 }) }, { status: method === "post" ? 201 : 200 });
      },
    );
    return { bodies, handler };
  }

  it("offers no category first, then the household's categories with their emoji", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: PATH });
    const select = await screen.findByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name: "🏠 Rent" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["No category", "🏠 Rent", "🛒 Groceries", "💡 Utilities", "🎉 Leisure", "📦 Other"]);
    expect(select).toHaveValue("");
  });

  it("saves the chosen category, or none", async () => {
    const { bodies, handler } = capture("post");
    server.use(handlers.signedIn(), handlers.household(homeView()), handler, handlers.expense());
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Shop");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), "42.80");
    const select = screen.getByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name: "🛒 Groceries" });
    await userEvent.selectOptions(select, "cat_groceries");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies[0]).toEqual(expect.objectContaining({ categoryId: "cat_groceries" }));
  });

  it("works with no categories at all", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.categories([]));
    renderApp({ path: PATH });
    const select = await screen.findByRole("combobox", { name: "Category" });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["No category"]);
  });

  it("names the category's own split and previews it before saving", async () => {
    const { bodies, handler } = capture("post");
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.categories([rentOwn, leisure]),
      handler,
      handlers.expense(),
    );
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Rent");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), "900");
    const select = screen.getByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name: "🏠 Rent" });
    await userEvent.selectOptions(select, "cat_rent");

    const weights = screen.getByRole("radio", { name: "Rent's split" });
    expect(weights).toBeChecked();
    expect(weights).toHaveAccessibleDescription("Ana García 50% and Bruno Díaz 50%");
    const rows = within(screen.getByRole("list", { name: "Each person's share" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€450.00");
    expect(rows[1]).toHaveTextContent("Bruno Díaz€450.00");

    await userEvent.selectOptions(select, "cat_leisure");
    expect(screen.getByRole("radio", { name: "The household's split" })).toHaveAccessibleDescription(
      "Ana García 75% and Bruno Díaz 25%",
    );
    await userEvent.selectOptions(select, "cat_rent");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies[0]).toEqual(
      expect.objectContaining({
        categoryId: "cat_rent",
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 45000 },
            { userId: "user_m_bruno", amountCents: 45000 },
          ],
        },
      }),
    );
  });

  it("doesn't offer the default split when nobody pays in the category, and points to its settings", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.categories([rentOwn, nobodyInDog]));
    renderApp({ path: PATH });
    const select = await screen.findByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name: "🐶 Dog" });
    await userEvent.selectOptions(select, "cat_dog");

    const weights = screen.getByRole("radio", { name: "Dog's split" });
    expect(weights).toBeDisabled();
    expect(weights).toHaveAccessibleDescription(expect.stringContaining("Nobody pays in Dog's split"));
    expect(screen.getByRole("radio", { name: "Equally between…" })).toBeChecked();
    expect(screen.getByRole("link", { name: "Review the category" })).toHaveAttribute(
      "href",
      "/household/settings#categories",
    );
  });

  it("keeps everything else when the category was deleted meanwhile, and asks for another", async () => {
    let deleted = false;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.get("*/api/household/categories", () =>
        HttpResponse.json({ categories: deleted ? [leisure] : [rentOwn, leisure] }),
      ),
      http.post("*/api/household/expenses", () => {
        deleted = true;
        return apiError(400, "expense.category.not_found");
      }),
    );
    renderApp({ path: PATH });
    await userEvent.type(await screen.findByRole("textbox", { name: "What was it?" }), "Bike");
    await userEvent.type(screen.getByRole("textbox", { name: "Amount (€)" }), "12");
    const select = screen.getByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name: "🏠 Rent" });
    await userEvent.selectOptions(select, "cat_rent");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));

    expect(
      await screen.findByText("That category isn't here any more. Pick another one, or leave it without a category."),
    ).toBeInTheDocument();
    expect(select).toHaveValue("");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "What was it?" })).toHaveValue("Bike");
    await waitFor(() => expect(within(select).queryByRole("option", { name: "🏠 Rent" })).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("switches an equal expense to the category's split, sending what it previewed", async () => {
    const { bodies, handler } = capture("put");
    const equal = expenseView({
      category: { id: "cat_rent", name: "Rent", emoji: "🏠" },
      amountCents: 90000,
      split: {
        method: "EQUAL",
        shares: [{ person: anaRef, amountCents: 90000 }],
      },
    });
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.categories([rentOwn]),
      handlers.expense(equal),
      handler,
    );
    renderApp({ path: "/expenses/expense_1/edit" });
    await userEvent.click(await screen.findByRole("radio", { name: "Rent's split" }));
    const rows = within(screen.getByRole("list", { name: "Each person's share" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€450.00");
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies[0]).toEqual(
      expect.objectContaining({
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 45000 },
            { userId: "user_m_bruno", amountCents: 45000 },
          ],
        },
      }),
    );
  });
});

describe("ExpenseFormPage › moving an expense to another category", () => {
  const EDIT = "/expenses/expense_1/edit";
  const rentOwn = categoryView({
    id: "cat_rent",
    name: "Rent",
    emoji: "🏠",
    ownSplit: true,
    weights: [
      { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 5000 },
      { membershipId: "m_bruno", userId: "user_m_bruno", weight: 1, shareBps: 5000 },
    ],
  });
  const leisure = categoryView({ id: "cat_leisure", name: "Leisure", emoji: "🎉", position: 2 });
  const other = categoryView({ id: "cat_other", name: "Other", emoji: "📦", position: 3 });
  /** €900.00 saved in Leisure with the household's 3 / 1 split. */
  const rentByMistake = expenseView({
    description: "Rent",
    amountCents: 90000,
    category: { id: "cat_leisure", name: "Leisure", emoji: "🎉" },
    split: {
      method: "WEIGHTS",
      shares: [
        { person: anaRef, amountCents: 67500 },
        { person: brunoRef, amountCents: 22500 },
      ],
    },
  });

  function setup(categories = [rentOwn, leisure, other], expense = rentByMistake) {
    const bodies: unknown[] = [];
    let answer: "ok" | "changed" = "ok";
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.categories(categories),
      handlers.expense(expense),
      http.put("*/api/household/expenses/:id", async ({ request }) => {
        bodies.push(await request.json());
        if (answer === "changed") {
          answer = "ok";
          return apiError(409, "expense.split.changed");
        }
        return HttpResponse.json({ expense: expenseView({ version: 2 }) });
      }),
    );
    renderApp({ path: EDIT });
    return {
      bodies,
      failNextWithChangedSplit: () => {
        answer = "changed";
      },
    };
  }

  async function moveTo(name: string) {
    const select = await screen.findByRole("combobox", { name: "Category" });
    await within(select).findByRole("option", { name });
    await userEvent.selectOptions(select, within(select).getByRole("option", { name }));
    await userEvent.click(screen.getByRole("button", { name: "Save expense" }));
  }

  it("describes a saved split neutrally", async () => {
    setup();
    expect(
      await screen.findByRole("radio", { name: "The split when it was added (Ana García 75% and Bruno Díaz 25%)" }),
    ).toBeChecked();
  });

  it("shows each person's share before and after, and applies the new split by default", async () => {
    const { bodies } = setup();
    await moveTo("🏠 Rent");

    const dialog = await screen.findByRole("dialog", { name: "The shares would change" });
    expect(within(dialog).getByText("Ana García: €675.00 → €450.00")).toBeInTheDocument();
    expect(within(dialog).getByText("Bruno Díaz: €225.00 → €450.00")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Apply Rent's split" })).toBeChecked();
    await expectNoA11yViolations(dialog);

    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies[0]).toEqual(
      expect.objectContaining({
        categoryId: "cat_rent",
        split: {
          method: "WEIGHTS",
          previewShares: [
            { userId: ana.id, amountCents: 45000 },
            { userId: "user_m_bruno", amountCents: 45000 },
          ],
        },
      }),
    );
  });

  it("keeps the current shares when asked to", async () => {
    const { bodies } = setup();
    await moveTo("🏠 Rent");
    const dialog = await screen.findByRole("dialog", { name: "The shares would change" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Keep the current shares" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies[0]).toEqual(expect.objectContaining({ categoryId: "cat_rent", split: { method: "WEIGHTS" } }));
  });

  it("asks nothing when the new category gives the same shares", async () => {
    const { bodies } = setup();
    await moveTo("📦 Other");
    await screen.findByRole("status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bodies[0]).toEqual(expect.objectContaining({ categoryId: "cat_other", split: { method: "WEIGHTS" } }));
  });

  it("never asks for an equal split", async () => {
    const { bodies } = setup(undefined, {
      ...rentByMistake,
      split: { ...rentByMistake.split, method: "EQUAL" },
    });
    await moveTo("🏠 Rent");
    await screen.findByRole("status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bodies[0]).toEqual(expect.objectContaining({ categoryId: "cat_rent" }));
  });

  it("only offers to keep the shares when nobody pays in the new category", async () => {
    const dog = categoryView({
      ...rentOwn,
      id: "cat_dog",
      name: "Dog",
      emoji: "🐶",
      weights: (rentOwn.weights ?? []).map((entry) => ({ ...entry, weight: 0, shareBps: 0 })),
    });
    setup([dog, leisure]);
    await moveTo("🐶 Dog");
    const dialog = await screen.findByRole("dialog", { name: "The shares would change" });
    expect(within(dialog).getByText("Dog's split has nobody paying, so it can't be applied.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /Apply/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Keep the current shares" })).toBeChecked();
  });

  it("shows the message and stays open when the split changed meanwhile", async () => {
    const { bodies, failNextWithChangedSplit } = setup();
    failNextWithChangedSplit();
    await moveTo("🏠 Rent");
    const dialog = await screen.findByRole("dialog", { name: "The shares would change" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The split changed while you were editing.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    await screen.findByRole("status");
    expect(bodies).toHaveLength(2);
  });
});
