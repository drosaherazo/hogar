import type { HouseholdView } from "@hogar/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { ana, handlers, householdView, member, server } from "../../test/server";

const PATH = "/household/settings";

const pair = (overrides: Partial<HouseholdView> = {}) =>
  householdView({
    members: [
      member({ id: "m_ana", userId: ana.id, name: "Ana García", role: "ADMIN", weight: 1, shareBps: 5000 }),
      member({ id: "m_bruno", name: "Bruno Díaz", weight: 1, shareBps: 5000 }),
    ],
    ...overrides,
  });

async function section() {
  return screen.findByRole("region", { name: "Split" });
}

describe("SplitSection", () => {
  it("updates percentages live and saves the weights", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(pair({ splitNeedsReview: true })),
      http.put("*/api/household/split", async ({ request }) => {
        expect(await request.json()).toEqual({
          weights: [
            { membershipId: "m_ana", weight: 3 },
            { membershipId: "m_bruno", weight: 1 },
          ],
        });
        return HttpResponse.json({
          household: pair({
            members: [
              member({ id: "m_ana", userId: ana.id, name: "Ana García", role: "ADMIN", weight: 3, shareBps: 7500 }),
              member({ id: "m_bruno", name: "Bruno Díaz", weight: 1, shareBps: 2500 }),
            ],
          }),
        });
      }),
    );
    renderApp({ path: PATH });

    const region = await section();
    expect(within(region).getByText("Review the split")).toBeInTheDocument();
    const anaWeight = within(region).getByRole("spinbutton", { name: "Ana García" });
    expect(anaWeight).toHaveAccessibleDescription("50% of shared costs");

    await userEvent.clear(anaWeight);
    await userEvent.type(anaWeight, "3");
    expect(anaWeight).toHaveAccessibleDescription("75% of shared costs");
    expect(within(region).getByRole("spinbutton", { name: "Bruno Díaz" })).toHaveAccessibleDescription(
      "25% of shared costs",
    );

    await userEvent.click(within(region).getByRole("button", { name: "Save split" }));
    expect(await within(region).findByRole("status")).toHaveTextContent("Split saved.");
    expect(within(region).queryByText("Review the split")).not.toBeInTheDocument();
  });

  it("explains invalid weights and keeps Save disabled", async () => {
    server.use(handlers.signedIn(), handlers.household(pair()));
    renderApp({ path: PATH });
    const region = await section();
    const anaWeight = within(region).getByRole("spinbutton", { name: "Ana García" });

    await userEvent.clear(anaWeight);
    await userEvent.type(anaWeight, "101");
    expect(anaWeight).toHaveAttribute("aria-invalid", "true");
    expect(anaWeight).toHaveAccessibleDescription(expect.stringContaining("whole number from 0 to 100"));
    expect(within(region).getByRole("button", { name: "Save split" })).toBeDisabled();
  });

  it("won't save a split where nobody pays", async () => {
    server.use(handlers.signedIn(), handlers.household(pair()));
    renderApp({ path: PATH });
    const region = await section();
    for (const name of ["Ana García", "Bruno Díaz"]) {
      const field = within(region).getByRole("spinbutton", { name });
      await userEvent.clear(field);
      await userEvent.type(field, "0");
    }
    expect(within(region).getByText(/otherwise nobody would pay/)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Save split" })).toBeDisabled();
  });

  it("shows members and guests the split without letting them change it", async () => {
    server.use(handlers.signedIn(), handlers.household(pair({ myRole: "GUEST", splitNeedsReview: true })));
    renderApp({ path: PATH });
    const region = await section();
    expect(within(region).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(within(region).getAllByText("Weight 1 · 50% of shared costs")).toHaveLength(2);
    expect(within(region).getByText("Only admins can change the split.")).toBeInTheDocument();
    expect(within(region).queryByText("Review the split")).not.toBeInTheDocument();
  });

  it("formats percentages for Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household(pair({ myRole: "MEMBER" })));
    renderApp({ path: PATH, locale: "es" });
    const region = await screen.findByRole("region", { name: "Reparto" });
    expect(within(region).getAllByText(/Peso 1 · 50\s%\sde los gastos compartidos/)).toHaveLength(2);
  });

  it("moves focus to the split when arriving from the home banner", async () => {
    server.use(handlers.signedIn(), handlers.household(pair({ splitNeedsReview: true })));
    renderApp({ path: `${PATH}#split` });
    const region = await section();
    expect(within(region).getByRole("heading", { name: "Split" })).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(pair({ splitNeedsReview: true })));
    const { container } = renderApp({ path: PATH });
    await section();
    await expectNoA11yViolations(container);
  });
});
