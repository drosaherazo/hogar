import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { localToday } from "../../i18n/format";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import {
  anaIsOwed,
  anaRef,
  balancesView,
  brunoRef,
  handlers,
  homeView,
  personRef,
  server,
  settlementView,
} from "../../test/server";

const PATH = "/balances";
const carlaRef = personRef({ userId: "user_m_carla", name: "Carla Ruiz" });

describe("BalancesPage", () => {
  it("sends people without a household back home", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    const { router } = renderApp({ path: PATH });
    await screen.findByRole("button", { name: "Create a household" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("says in words where everyone stands, speaking to the viewer directly", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
    renderApp({ path: PATH });

    const everyone = await screen.findByRole("region", { name: "Everyone's balance" });
    const rows = within(everyone).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("You're owed €7.70 in total");
    expect(rows[1]).toHaveTextContent("Bruno Díaz owes €7.70");
  });

  it("phrases suggested payments from the viewer's point of view", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.balances(
        balancesView({
          balances: [
            { person: anaRef, balanceCents: -500 },
            { person: brunoRef, balanceCents: 1500 },
            { person: carlaRef, balanceCents: -1000 },
          ],
          suggestions: [
            { from: carlaRef, to: brunoRef, amountCents: 1000 },
            { from: anaRef, to: brunoRef, amountCents: 500 },
          ],
          myBalanceCents: -500,
        }),
      ),
    );
    renderApp({ path: PATH });

    const suggestions = await screen.findByRole("region", { name: "Payments that would settle everyone" });
    const rows = within(suggestions).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Carla Ruiz owes Bruno Díaz €10.00");
    expect(rows[1]).toHaveTextContent("You owe Bruno Díaz €5.00");
    expect(screen.getByText("Bruno Díaz is owed €15.00")).toBeInTheDocument();
  });

  it("says when someone owes the viewer", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
    renderApp({ path: PATH });
    const suggestions = await screen.findByRole("region", { name: "Payments that would settle everyone" });
    expect(within(suggestions).getByRole("listitem")).toHaveTextContent("Bruno Díaz owes you €7.70");
  });

  it("celebrates when everyone is square", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.balances(
        balancesView({
          balances: [
            { person: anaRef, balanceCents: 0 },
            { person: brunoRef, balanceCents: 0 },
          ],
        }),
      ),
    );
    renderApp({ path: PATH });
    expect(await screen.findByRole("heading", { name: "All square! Nobody owes anything." })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Payments that would settle everyone" })).not.toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
    renderApp({ path: PATH, locale: "es" });
    expect(await screen.findByText("Te deben 7,70 € en total")).toBeInTheDocument();
    expect(screen.getByText("Bruno Díaz te debe 7,70 €")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
    const { container } = renderApp({ path: PATH });
    await screen.findByRole("region", { name: "Everyone's balance" });
    await expectNoA11yViolations(container);
  });
});

describe("BalancesPage › recording payments", () => {
  const square = balancesView({
    balances: [
      { person: anaRef, balanceCents: 0 },
      { person: brunoRef, balanceCents: 0 },
    ],
  });

  it("records a suggested payment, already filled in, and shows the new balances", async () => {
    let settled = false;
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.get("*/api/household/balances", () => HttpResponse.json(settled ? square : anaIsOwed())),
      http.post("*/api/household/settlements", async ({ request }) => {
        body = await request.json();
        settled = true;
        return HttpResponse.json({ settlement: settlementView() }, { status: 201 });
      }),
    );
    renderApp({ path: PATH });

    await userEvent.click(await screen.findByRole("button", { name: "Record this payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a payment" });
    expect(within(dialog).getByRole("combobox", { name: "Who paid?" })).toHaveValue(brunoRef.userId);
    expect(within(dialog).getByRole("combobox", { name: "Who received it?" })).toHaveValue(anaRef.userId);
    expect(within(dialog).getByRole("textbox", { name: "Amount (€)" })).toHaveValue("7.70");
    expect(within(dialog).getByText("Right now, Bruno Díaz owes Ana García €7.70.")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Payment recorded.");
    expect(await screen.findByRole("heading", { name: "All square! Nobody owes anything." })).toBeInTheDocument();
    expect(body).toEqual({
      fromUserId: brunoRef.userId,
      toUserId: anaRef.userId,
      amountCents: 770,
      date: localToday(),
    });
  });

  it("explains that paying more than what's owed reverses who owes whom", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(anaIsOwed()));
    renderApp({ path: PATH });
    await userEvent.click(await screen.findByRole("button", { name: "Record this payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a payment" });
    const amount = within(dialog).getByRole("textbox", { name: "Amount (€)" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "10.00");
    expect(
      within(dialog).getByText("That's more than what's owed, so afterwards Ana García will owe Bruno Díaz €2.30."),
    ).toBeInTheDocument();
  });

  it("explains mistakes next to the fields, without sending anything", async () => {
    let posted = false;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.balances(anaIsOwed()),
      http.post("*/api/household/settlements", () => {
        posted = true;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    renderApp({ path: PATH });
    await userEvent.click(await screen.findByRole("button", { name: "Record a payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a payment" });
    expect(within(dialog).getByRole("combobox", { name: "Who paid?" })).toHaveValue(anaRef.userId);
    await userEvent.selectOptions(within(dialog).getByRole("combobox", { name: "Who received it?" }), anaRef.userId);
    await userEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));

    expect(within(dialog).getByRole("combobox", { name: "Who received it?" })).toHaveAccessibleDescription(
      "Choose two different people.",
    );
    expect(within(dialog).getByRole("textbox", { name: "Amount (€)" })).toHaveAccessibleDescription(
      expect.stringContaining("Enter an amount from €0.01"),
    );
    expect(posted).toBe(false);
  });

  it("doesn't offer guests to record payments", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: "GUEST" })), handlers.balances(anaIsOwed()));
    renderApp({ path: PATH });
    await screen.findByRole("region", { name: "Payments that would settle everyone" });
    expect(screen.queryByRole("button", { name: "Record this payment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record a payment" })).not.toBeInTheDocument();
  });
});

describe("BalancesPage › former members", () => {
  const formerCarla = personRef({ userId: "user_carla", name: "Carla Ruiz", former: true });
  const withFormer = balancesView({
    balances: [
      { person: anaRef, balanceCents: 500 },
      { person: brunoRef, balanceCents: 0 },
      { person: formerCarla, balanceCents: -500 },
    ],
    suggestions: [{ from: formerCarla, to: anaRef, amountCents: 500 }],
    myBalanceCents: 500,
  });

  it("marks people who are no longer members, in words", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(withFormer));
    renderApp({ path: PATH });
    const everyone = await screen.findByRole("region", { name: "Everyone's balance" });
    const carla = within(everyone).getAllByRole("listitem")[2];
    expect(carla).toHaveTextContent("Carla Ruiz owes €5.00");
    expect(carla).toHaveTextContent("Former member");
  });

  it("offers to record a payment with them", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.balances(withFormer));
    renderApp({ path: PATH });
    await userEvent.click(await screen.findByRole("button", { name: "Record a payment" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a payment" });
    const from = within(dialog).getByRole("combobox", { name: "Who paid?" });
    expect(within(from).getByRole("option", { name: "Carla Ruiz (former member)" })).toBeInTheDocument();
  });
});
