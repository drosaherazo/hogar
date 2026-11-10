import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { handlers, householdView, server } from "../../test/server";

const PATH = "/household/settings";

describe("HouseholdSettingsPage", () => {
  it("sends people without a household back home", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    const { router } = renderApp({ path: PATH });
    await screen.findByRole("button", { name: "Create a household" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("lets an admin rename the household", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(),
      http.patch("*/api/household", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "Casa nueva" });
        return HttpResponse.json({ household: householdView({ name: "Casa nueva" }) });
      }),
    );
    renderApp({ path: PATH });

    const section = await screen.findByRole("region", { name: "Name" });
    const field = within(section).getByRole("textbox", { name: "Household name" });
    const save = within(section).getByRole("button", { name: "Save name" });
    expect(save).toBeDisabled();

    await userEvent.clear(field);
    await userEvent.type(field, "Casa nueva");
    await userEvent.click(save);

    expect(await within(section).findByRole("status")).toHaveTextContent("Name saved.");
    expect(field).toHaveValue("Casa nueva");
  });

  it("validates the new name before saving", async () => {
    server.use(handlers.signedIn(), handlers.household());
    renderApp({ path: PATH });
    const section = await screen.findByRole("region", { name: "Name" });
    const field = within(section).getByRole("textbox");
    await userEvent.clear(field);
    await userEvent.type(field, "a".repeat(51));
    await userEvent.click(within(section).getByRole("button", { name: "Save name" }));
    expect(field).toHaveAccessibleDescription(expect.stringContaining("50 characters or fewer"));
  });

  it("shows the name read-only to members and guests", async () => {
    server.use(handlers.signedIn(), handlers.household(householdView({ myRole: "GUEST" })));
    renderApp({ path: PATH });
    const section = await screen.findByRole("region", { name: "Name" });
    expect(within(section).getByText("Casa Ana")).toBeInTheDocument();
    expect(within(section).getByText("Only admins can change the name.")).toBeInTheDocument();
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("links back home and speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household());
    renderApp({ path: PATH, locale: "es" });
    expect(await screen.findByRole("heading", { level: 1, name: "Ajustes del hogar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household());
    const { container } = renderApp({ path: PATH });
    await screen.findByRole("region", { name: "Name" });
    await expectNoA11yViolations(container);
  });
});
