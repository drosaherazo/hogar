import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { anaIsOwed, anaRef, balancesView, brunoRef, handlers, homeView, personRef, server } from "../../test/server";

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
