import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import {
  anaRef,
  brunoRef,
  expenseItem,
  handlers,
  homeView,
  server,
  settlementItem,
  settlementView,
} from "../../test/server";

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

  it("shows payments in the history and opens their details", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({ items: [settlementItem(), expenseItem({ date: "2026-11-09" })], nextCursor: null }),
      handlers.settlement(settlementView()),
    );
    renderApp({ path: PATH });

    const payment = await screen.findByRole("button", { name: /Bruno Díaz paid Ana García/ });
    expect(payment).toHaveTextContent("€7.70");
    await userEvent.click(payment);
    const dialog = await screen.findByRole("dialog", { name: "Payment" });
    expect(await within(dialog).findByText(/Added by Ana García on/)).toBeInTheDocument();
    expect(within(dialog).getByText("Bruno Díaz paid Ana García")).toBeInTheDocument();
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

describe("ExpensesPage › fixing mistakes", () => {
  const deletion = (by = brunoRef) => ({ by, at: "2026-11-11T09:00:00.000Z" });

  it("keeps deleted records as a muted line that can't be opened", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({
        items: [
          expenseItem({ deleted: deletion(), viewerPart: { kind: "none", amountCents: 0 } }),
          settlementItem({ id: "s2", deleted: deletion(anaRef) }),
        ],
        nextCursor: null,
      }),
    );
    renderApp({ path: PATH });

    expect(await screen.findByText('Bruno Díaz deleted "Groceries" (€42.80)')).toBeInTheDocument();
    expect(
      screen.getByText("Ana García deleted the payment from Bruno Díaz to Ana García (€7.70)"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Groceries/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /paid Ana García/ })).not.toBeInTheDocument();
  });

  it("lets editors change a payment from its details", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({ items: [settlementItem()], nextCursor: null }),
      handlers.settlement(),
      http.put("*/api/household/settlements/:id", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ settlement: settlementView({ amountCents: 500, version: 2 }) });
      }),
    );
    renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("button", { name: /Bruno Díaz paid Ana García/ }));
    const details = await screen.findByRole("dialog", { name: "Payment" });
    await userEvent.click(await within(details).findByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("dialog", { name: "Edit payment" });
    const amount = within(form).getByRole("textbox", { name: "Amount (€)" });
    expect(amount).toHaveValue("7.70");
    await userEvent.clear(amount);
    await userEvent.type(amount, "5.00");
    await userEvent.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit payment" })).not.toBeInTheDocument());
    expect(body).toEqual(expect.objectContaining({ amountCents: 500, version: 1 }));
  });

  it("lets editors delete a payment after confirming", async () => {
    let version: string | null = null;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.activity({ items: [settlementItem()], nextCursor: null }),
      handlers.settlement(),
      http.delete("*/api/household/settlements/:id", ({ request }) => {
        version = new URL(request.url).searchParams.get("version");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("button", { name: /Bruno Díaz paid Ana García/ }));
    const details = await screen.findByRole("dialog", { name: "Payment" });
    await userEvent.click(await within(details).findByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Delete the payment from Bruno Díaz to Ana García (€7.70)?",
    });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete payment" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(version).toBe("1");
  });

  it("only lets guests look at a payment", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ myRole: "GUEST" })),
      handlers.activity({ items: [settlementItem()], nextCursor: null }),
      handlers.settlement(),
    );
    renderApp({ path: PATH });
    await userEvent.click(await screen.findByRole("button", { name: /Bruno Díaz paid Ana García/ }));
    const details = await screen.findByRole("dialog", { name: "Payment" });
    await within(details).findByText(/Added by/);
    expect(within(details).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
