import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { brunoRef, expenseItem, handlers, homeView, server } from "../../test/server";

const PATH = "/expenses";

describe("ExpensesPage", () => {
  it("sends people without a household back home", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    const { router } = renderApp({ path: PATH });
    await screen.findByRole("button", { name: "Create a household" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("shows a friendly empty state with a way to add the first expense", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.activity({ items: [], nextCursor: null }));
    renderApp({ path: PATH });
    expect(await screen.findByRole("heading", { name: "No expenses yet" })).toBeInTheDocument();
    expect(screen.getByText("When someone pays for something everyone shares, add it here.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Add expense" })[0]).toHaveAttribute("href", "/expenses/new");
  });

  it("lists expenses by month, newest first, with each person's own part", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({
        items: [
          expenseItem({
            id: "dinner",
            description: "Dinner",
            amountCents: 2000,
            date: "2026-11-10",
            paidBy: brunoRef,
            viewerPart: { kind: "owes", amountCents: 500 },
          }),
          expenseItem({ id: "groceries", description: "Groceries", date: "2026-10-28" }),
        ],
        nextCursor: null,
      }),
    );
    renderApp({ path: PATH });

    const november = await screen.findByRole("region", { name: "November 2026" });
    const dinner = within(november).getByRole("link", { name: /Dinner/ });
    expect(dinner).toHaveAttribute("href", "/expenses/dinner");
    expect(dinner).toHaveTextContent("Bruno Díaz paid");
    expect(dinner).toHaveTextContent("€20.00");
    expect(dinner).toHaveTextContent("You owe €5.00");

    const october = screen.getByRole("region", { name: "October 2026" });
    const groceries = within(october).getByRole("link", { name: /Groceries/ });
    expect(groceries).toHaveTextContent("You paid");
    expect(groceries).toHaveTextContent("You lent €10.70");
  });

  it("loads older expenses when asked", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity(
        { items: [expenseItem({ id: "dinner", description: "Dinner" })], nextCursor: "page-2" },
        { items: [expenseItem({ id: "groceries", description: "Groceries", date: "2026-10-28" })], nextCursor: null },
      ),
    );
    renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByRole("link", { name: /Groceries/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dinner/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("doesn't offer to add expenses to guests", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ myRole: "GUEST" })),
      handlers.activity({ items: [expenseItem()], nextCursor: null }),
    );
    renderApp({ path: PATH });
    await screen.findByRole("link", { name: /Groceries/ });
    expect(screen.queryByRole("link", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({ items: [expenseItem()], nextCursor: "more" }),
    );
    const { container } = renderApp({ path: PATH });
    await screen.findByRole("link", { name: /Groceries/ });
    await expectNoA11yViolations(container);
  });
});
