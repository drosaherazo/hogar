import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { localToday } from "../../i18n/format";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { ana, apiError, expenseView, handlers, homeView, member, server } from "../../test/server";

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
      split: { method: "WEIGHTS" },
    });
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
        name: "The household's split when it was added (Ana García 75% and Bruno Díaz 25%)",
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
