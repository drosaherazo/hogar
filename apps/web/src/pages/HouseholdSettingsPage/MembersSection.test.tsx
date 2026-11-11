import type { HouseholdView } from "@hogar/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { ana, apiError, balancesView, handlers, householdView, member, personRef, server } from "../../test/server";

const PATH = "/household/settings";

const anaAdmin = member({ id: "m_ana", userId: ana.id, name: "Ana García", role: "ADMIN" });
const brunoMember = member({ id: "m_bruno", name: "Bruno Díaz", role: "MEMBER" });
const carlaGuest = member({ id: "m_carla", name: "Carla Ruiz", role: "GUEST", weight: 0 });

const threeOfUs = (overrides: Partial<HouseholdView> = {}) =>
  householdView({ members: [anaAdmin, brunoMember, carlaGuest], ...overrides });

async function section() {
  return screen.findByRole("region", { name: "People" });
}

describe("MembersSection", () => {
  it("lists everyone with their role, marking who you are", async () => {
    server.use(handlers.signedIn(), handlers.household(threeOfUs()));
    renderApp({ path: PATH });
    const region = await section();
    const rows = within(region).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Ana García (you)Admin"),
      expect.stringContaining("Bruno DíazMember"),
      expect.stringContaining("Carla RuizGuest"),
    ]);
  });

  it("lets an admin change someone's role", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(threeOfUs()),
      http.patch("*/api/household/members/m_bruno", async ({ request }) => {
        expect(await request.json()).toEqual({ role: "ADMIN" });
        return HttpResponse.json({
          household: threeOfUs({ members: [anaAdmin, { ...brunoMember, role: "ADMIN" }, carlaGuest] }),
        });
      }),
    );
    renderApp({ path: PATH });

    const region = await section();
    await userEvent.click(within(region).getByRole("button", { name: "Options for Bruno Díaz" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Admin" }));
    const brunoRow = within(region).getByText("Bruno Díaz").closest("li");
    expect(await within(brunoRow as HTMLElement).findByText("Admin")).toBeInTheDocument();
  });

  it("asks before removing someone and names them", async () => {
    let removed = false;
    server.use(
      handlers.signedIn(),
      handlers.household(threeOfUs()),
      http.delete("*/api/household/members/m_carla", () => {
        removed = true;
        return HttpResponse.json({ household: threeOfUs({ members: [anaAdmin, brunoMember] }) });
      }),
    );
    renderApp({ path: PATH });

    const region = await section();
    await userEvent.click(within(region).getByRole("button", { name: "Options for Carla Ruiz" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove from household" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Carla Ruiz?" });
    expect(removed).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove Carla Ruiz" }));

    expect(removed).toBe(true);
    expect(await within(region).findAllByRole("listitem")).toHaveLength(2);
  });

  it("explains why the only admin can't step down or leave", async () => {
    server.use(handlers.signedIn(), handlers.household(threeOfUs()));
    renderApp({ path: PATH });
    const region = await section();
    expect(within(region).queryByRole("button", { name: "Options for Ana García" })).not.toBeInTheDocument();
    expect(within(region).getByText(/You're the only admin/)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Leave household" })).toBeDisabled();
  });

  it("shows what the server refused", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(threeOfUs()),
      http.patch("*/api/household/members/m_bruno", () => apiError(409, "household.last_admin")),
    );
    renderApp({ path: PATH });
    const region = await section();
    await userEvent.click(within(region).getByRole("button", { name: "Options for Bruno Díaz" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Guest" }));
    expect(await within(region).findByRole("alert")).toHaveTextContent(/Make someone else an admin first/);
  });

  it("lets a member leave and takes them home", async () => {
    let left = false;
    server.use(
      handlers.signedIn(),
      http.get("*/api/household", () =>
        HttpResponse.json(
          left
            ? { household: null, removedFrom: null }
            : { household: threeOfUs({ myRole: "MEMBER", myMembershipId: "m_bruno" }) },
        ),
      ),
      http.post("*/api/household/leave", () => {
        left = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp({ path: PATH });

    const region = await section();
    expect(within(region).queryByRole("button", { name: /Options for/ })).not.toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: "Leave household" }));
    const dialog = await screen.findByRole("dialog", { name: "Leave Casa Ana?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave household" }));

    expect(await screen.findByRole("button", { name: "Create a household" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("warns the last member that leaving deletes the household", async () => {
    server.use(handlers.signedIn(), handlers.household());
    renderApp({ path: PATH });
    await userEvent.click(within(await section()).getByRole("button", { name: "Leave household" }));
    const dialog = await screen.findByRole("dialog", { name: "Leave Casa Ana?" });
    expect(dialog).toHaveAccessibleDescription(
      /Casa Ana and all its expenses and payments will be deleted when you leave/,
    );
    expect(within(dialog).getByRole("button", { name: "Leave and delete household" })).toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household(threeOfUs()));
    renderApp({ path: PATH, locale: "es" });
    const region = await screen.findByRole("region", { name: "Personas" });
    expect(within(region).getByText("Invitado")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Opciones para Bruno Díaz" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(threeOfUs()));
    const { container } = renderApp({ path: PATH });
    await section();
    await expectNoA11yViolations(container);
  });
});

describe("MembersSection › money still owed", () => {
  const asBruno = threeOfUs({ myRole: "MEMBER", myMembershipId: "m_bruno" });
  const brunoRef = personRef({ userId: brunoMember.userId, name: "Bruno Díaz" });
  const carlaRef = personRef({ userId: carlaGuest.userId, name: "Carla Ruiz" });

  async function openLeaveDialog() {
    await userEvent.click(within(await section()).getByRole("button", { name: "Leave household" }));
    return screen.findByRole("dialog", { name: "Leave Casa Ana?" });
  }

  it("tells someone leaving what they still owe, and that it stays in the balances", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(asBruno),
      handlers.balances(balancesView({ balances: [{ person: brunoRef, balanceCents: -500 }], myBalanceCents: -500 })),
    );
    renderApp({ path: PATH });
    const dialog = await openLeaveDialog();
    expect(
      await within(dialog).findByText(
        "You still owe €5.00 in total. It will stay in the balances under your name until someone records that it's paid.",
      ),
    ).toBeInTheDocument();
  });

  it("tells someone leaving what they're still owed", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(asBruno),
      handlers.balances(balancesView({ balances: [{ person: brunoRef, balanceCents: 500 }], myBalanceCents: 500 })),
    );
    renderApp({ path: PATH });
    const dialog = await openLeaveDialog();
    expect(await within(dialog).findByText(/You're still owed €5.00 in total/)).toBeInTheDocument();
  });

  it("says nothing about money when the person is square", async () => {
    server.use(handlers.signedIn(), handlers.household(asBruno));
    renderApp({ path: PATH });
    const dialog = await openLeaveDialog();
    expect(within(dialog).queryByText(/still owe/)).not.toBeInTheDocument();
  });

  it("tells an admin what the person they remove still owes", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(threeOfUs()),
      handlers.balances(balancesView({ balances: [{ person: carlaRef, balanceCents: -770 }] })),
    );
    renderApp({ path: PATH });
    const region = await section();
    await userEvent.click(within(region).getByRole("button", { name: "Options for Carla Ruiz" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove from household" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Carla Ruiz?" });
    expect(await within(dialog).findByText(/Carla Ruiz still owes €7.70 in total/)).toBeInTheDocument();
  });
});
