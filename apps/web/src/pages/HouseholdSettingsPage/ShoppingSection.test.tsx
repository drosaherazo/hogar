import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { fakeHouseholdEvents } from "../../test/fakeHouseholdEvents";
import { renderApp } from "../../test/renderApp";
import { apiError, handlers, homeView, server } from "../../test/server";

const PATH = "/household/settings";

const section = () => screen.findByRole("region", { name: "Shopping list" });
const checkbox = (region: HTMLElement) =>
  within(region).getByRole("checkbox", { name: "Show who asked for each item" });

describe("ShoppingSection", () => {
  it("lets an admin hide who asked for each item, for the whole household", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.patch("*/api/household", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ household: homeView({ showWhoAsked: false }) });
      }),
    );
    const { container } = renderApp({ path: PATH });
    const region = await section();
    const box = checkbox(region);
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription("Handy for knowing who to ask in the shop. When it's off, nobody sees it.");
    const save = within(region).getByRole("button", { name: "Save setting" });
    expect(save).toBeDisabled();

    await userEvent.click(box);
    await userEvent.click(save);

    expect(await within(region).findByRole("status")).toHaveTextContent("Setting saved.");
    expect(body).toEqual({ showWhoAsked: false });
    expect(checkbox(region)).not.toBeChecked();
    await expectNoA11yViolations(container);
  });

  it("lets an admin show it again", async () => {
    let body: unknown;
    server.use(
      handlers.signedIn(),
      handlers.household(homeView({ showWhoAsked: false })),
      http.patch("*/api/household", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ household: homeView({ showWhoAsked: true }) });
      }),
    );
    renderApp({ path: PATH });
    const region = await section();
    expect(checkbox(region)).not.toBeChecked();

    await userEvent.click(checkbox(region));
    await userEvent.click(within(region).getByRole("button", { name: "Save setting" }));

    expect(await within(region).findByRole("status")).toHaveTextContent("Setting saved.");
    expect(body).toEqual({ showWhoAsked: true });
  });

  it("keeps the choice and says what went wrong when it can't be saved", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      http.patch("*/api/household", () => apiError(403, "household.forbidden")),
    );
    renderApp({ path: PATH });
    const region = await section();

    await userEvent.click(checkbox(region));
    await userEvent.click(within(region).getByRole("button", { name: "Save setting" }));

    expect(await within(region).findByRole("alert")).toHaveTextContent("Only the household's admins can do that.");
    expect(checkbox(region)).not.toBeChecked();
  });

  it("follows another admin's change while the box is untouched", async () => {
    const householdEvents = fakeHouseholdEvents();
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: PATH, householdEvents });
    const region = await section();
    expect(checkbox(region)).toBeChecked();
    act(() => householdEvents.connect());

    server.use(handlers.household(homeView({ showWhoAsked: false })));
    act(() => householdEvents.emit("household:changed"));

    await waitFor(() => expect(checkbox(region)).not.toBeChecked());
  });

  it.each(["MEMBER", "GUEST"] as const)("isn't shown to a %s", async (role) => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: role })));
    renderApp({ path: PATH });
    expect(await screen.findByRole("region", { name: "Categories" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Shopping list" })).not.toBeInTheDocument();
  });
});
