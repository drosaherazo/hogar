import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type * as Shared from "@hogar/shared";
import { renderApp } from "../../test/renderApp";
import { handlers, householdView, server } from "../../test/server";

// No currency is retired in today's CLDR table, so pretend Colombian pesos were withdrawn.
vi.mock("@hogar/shared", async (importOriginal) => {
  const shared = await importOriginal<typeof Shared>();
  return {
    ...shared,
    isRetired: (code: string) => code === "COP",
    OFFERED_CURRENCY_CODES: shared.OFFERED_CURRENCY_CODES.filter((code) => code !== "COP"),
  };
});

describe("CurrencySection with a retired currency", () => {
  it("still shows a household's retired currency, and offers it only to that household", async () => {
    server.use(handlers.signedIn(), handlers.household(householdView({ currency: "COP" })));
    renderApp({ path: "/household/settings" });

    const section = await screen.findByRole("region", { name: "Currency" });
    const field = within(section).getByRole("combobox", { name: "Household currency" });
    expect(field).toHaveValue("Colombian Peso");
    await userEvent.clear(field);
    await userEvent.type(field, "colombia");
    expect(await screen.findByRole("option", { name: /Colombian Peso COP/ })).toBeInTheDocument();
  });

  it("doesn't offer a retired currency when creating a household", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    renderApp({ path: "/" });

    await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
    const field = within(await screen.findByRole("dialog")).getByRole("combobox", { name: "Currency" });
    await userEvent.clear(field);
    await userEvent.type(field, "colombia");
    expect(await screen.findByRole("listbox")).toHaveTextContent("No currency matches “colombia”.");
  });
});
