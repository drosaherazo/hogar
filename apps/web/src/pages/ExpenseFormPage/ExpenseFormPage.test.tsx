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
