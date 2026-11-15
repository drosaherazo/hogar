import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { apiError, handlers, householdView, server } from "../../test/server";

const PATH = "/household/settings";

const currencySection = () => screen.findByRole("region", { name: "Currency" });

describe("CurrencySection", () => {
  it("lets an admin change the currency before any money is recorded", async () => {
    let sent: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(),
      http.patch("*/api/household", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ household: householdView({ currency: "COP" }) });
      }),
    );
    renderApp({ path: PATH });

    const section = await currencySection();
    const select = within(section).getByRole("combobox", { name: "Household currency" });
    expect(select).toHaveDisplayValue("Euro");
    const save = within(section).getByRole("button", { name: "Save currency" });
    expect(save).toBeDisabled();

    await userEvent.selectOptions(select, "COP");
    await userEvent.click(save);

    expect(await within(section).findByRole("status")).toHaveTextContent("Currency saved.");
    expect(sent).toEqual({ currency: "COP" });
    expect(select).toHaveDisplayValue("Colombian Peso");
  });

  it("shows a fixed currency, and why, once the household has money", async () => {
    server.use(handlers.signedIn(), handlers.household(householdView({ currency: "COP", currencyLocked: true })));
    renderApp({ path: PATH });

    const section = await currencySection();
    expect(within(section).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(section).getByText("Colombian Peso")).toBeInTheDocument();
    expect(
      within(section).getByText("The currency is fixed once the household has expenses or payments."),
    ).toBeInTheDocument();
  });

  it("explains, where focus lands, that someone recorded money while the admin was choosing", async () => {
    let locked = false;
    server.use(
      handlers.signedIn(),
      http.get("*/api/household", () => HttpResponse.json({ household: householdView({ currencyLocked: locked }) })),
      http.patch("*/api/household", () => {
        locked = true;
        return apiError(409, "household.currency.locked");
      }),
    );
    renderApp({ path: PATH });

    const section = await currencySection();
    await userEvent.selectOptions(within(section).getByRole("combobox", { name: "Household currency" }), "USD");
    await userEvent.click(within(section).getByRole("button", { name: "Save currency" }));

    const hint = await within(section).findByText("The currency is fixed once the household has expenses or payments.");
    await waitFor(() => expect(hint).toHaveFocus());
    expect(within(section).getByText("Euro")).toBeInTheDocument();
  });

  it.each(["MEMBER", "GUEST"] as const)("shows the currency read-only to a %s", async (role) => {
    server.use(handlers.signedIn(), handlers.household(householdView({ myRole: role })));
    renderApp({ path: PATH });

    const section = await currencySection();
    expect(within(section).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(section).getByText("Euro")).toBeInTheDocument();
    expect(within(section).getByText("Only admins can change the currency.")).toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household());
    renderApp({ path: PATH, locale: "es" });
    const section = await screen.findByRole("region", { name: "Moneda" });
    expect(within(section).getByRole("combobox", { name: "Moneda del hogar" })).toHaveDisplayValue("euro");
    expect(within(section).getByRole("button", { name: "Guardar moneda" })).toBeInTheDocument();
  });

  it.each([
    ["editable", householdView()],
    ["locked", householdView({ currencyLocked: true })],
    ["read-only", householdView({ myRole: "GUEST" })],
  ])("has no accessibility violations when %s", async (_, household) => {
    server.use(handlers.signedIn(), handlers.household(household));
    const { container } = renderApp({ path: PATH });
    await currencySection();
    await expectNoA11yViolations(container);
  });
});
