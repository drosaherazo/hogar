import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { apiError, brunoRef, expenseView, handlers, homeView, server } from "../../test/server";

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

  it.each([
    ["EQUAL", "Equally between 2 people"],
    ["EXACT", "Exact amounts"],
  ] as const)("names how a %s expense was split", async (method, label) => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.expense(expenseView({ split: { ...expenseView().split, method } })),
    );
    renderApp({ path: PATH });
    await screen.findByRole("heading", { name: "Groceries" });
    expect(screen.getByText("How it's split").nextElementSibling).toHaveTextContent(label);
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

describe("ExpenseDetailPage › fixing mistakes", () => {
  it("says who changed it last", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.expense(expenseView({ editedBy: brunoRef, editedAt: "2026-11-11T09:00:00.000Z", version: 2 })),
    );
    renderApp({ path: PATH });
    expect(await screen.findByText(/Changed by Bruno Díaz on/)).toBeInTheDocument();
  });

  it("offers editors a way to edit it", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.expense());
    renderApp({ path: PATH });
    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute("href", "/expenses/expense_1/edit");
  });

  it("asks before deleting, naming the expense and starting on Cancel, then says it's done", async () => {
    let version: string | null = null;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.expense(),
      handlers.activity({ items: [], nextCursor: null }),
      http.delete("*/api/household/expenses/:id", ({ request }) => {
        version = new URL(request.url).searchParams.get("version");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: 'Delete "Groceries" (€42.80)?' });
    expect(within(dialog).getByText(/The history will keep a note that you deleted it/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete expense" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Expense deleted.");
    expect(router.state.location.pathname).toBe("/expenses");
    expect(version).toBe("1");
  });

  it("doesn't offer guests to edit or delete", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: "GUEST" })), handlers.expense());
    renderApp({ path: PATH });
    await screen.findByRole("heading", { name: "Groceries" });
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
