import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { apiError, expenseView, handlers, homeView, server } from "../../test/server";
import { http } from "msw";

const PATH = "/expenses/expense_1";

describe("ExpenseDetailPage", () => {
  it("shows the expense, how it's split and who added it", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.expense());
    renderApp({ path: PATH });

    expect(await screen.findByRole("heading", { name: "Groceries" })).toBeInTheDocument();
    expect(screen.getByText("€42.80")).toBeInTheDocument();
    expect(screen.getByText("Paid by").nextElementSibling).toHaveTextContent("Ana García");
    expect(screen.getByText("How it's split").nextElementSibling).toHaveTextContent("The household's split");

    const shares = screen.getByRole("list", { name: "Each person's share" });
    const rows = within(shares).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ana García€32.10");
    expect(rows[1]).toHaveTextContent("Bruno Díaz€10.70");
    expect(screen.getByText(/Added by Ana García on/)).toBeInTheDocument();
  });

  it("explains kindly when the expense isn't there any more", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.get("*/api/household/expenses/:id", () => apiError(404, "expense.not_found")),
    );
    renderApp({ path: PATH });
    expect(await screen.findByRole("alert")).toHaveTextContent("That expense isn't here any more.");
    expect(screen.getByRole("link", { name: "Back to expenses" })).toHaveAttribute("href", "/expenses");
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.expense(expenseView()));
    const { container } = renderApp({ path: PATH });
    await screen.findByRole("heading", { name: "Groceries" });
    await expectNoA11yViolations(container);
  });
});
