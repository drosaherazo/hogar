import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { installFakeGoogle, renderApp } from "../../test/renderApp";
import { ana, apiError, handlers, householdView, member, server } from "../../test/server";
import { firstName } from "./HomePage";

describe("firstName", () => {
  it.each([
    ["Ana García", "Ana"],
    ["  María José López ", "María"],
    ["Ana", "Ana"],
  ])("%s → %s", (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});

describe("HomePage", () => {
  describe("without a household", () => {
    it("greets the person and offers to create a household", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      renderApp({ path: "/" });
      expect(await screen.findByRole("heading", { level: 1, name: "Hi, Ana" })).toBeInTheDocument();
      expect(await screen.findByRole("region", { name: "You're not part of a household yet" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create a household" })).toBeEnabled();
      expect(screen.getByText(/Got an invitation link/)).toBeInTheDocument();
    });

    it("gently tells a removed person, once, and tells the server it was seen", async () => {
      let dismissals = 0;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold("Piso Lavapiés"),
        http.delete("*/api/me/removal-notice", () => {
          dismissals += 1;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderApp({ path: "/" });

      const note = await screen.findByText(/You're no longer part of Piso Lavapiés/);
      expect(note.closest("[role=status]")).not.toBeNull();
      await waitFor(() => expect(dismissals).toBe(1));
      // Still on screen for this visit, even after the server forgot it.
      expect(screen.getByText(/You're no longer part of Piso Lavapiés/)).toBeInTheDocument();
    });

    it("creates a household with a valid name and shows it", async () => {
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", async ({ request }) => {
          expect(await request.json()).toEqual({ name: "Casa Ana" });
          return HttpResponse.json({ household: householdView() }, { status: 201 });
        }),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog", { name: "Create your household" });
      await userEvent.type(within(dialog).getByRole("textbox", { name: "Household name" }), "  Casa Ana ");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(await screen.findByRole("heading", { level: 2, name: "Casa Ana" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("1 person lives here")).toBeInTheDocument();
    });

    it("explains an empty name without calling the API", async () => {
      let called = false;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", () => {
          called = true;
          return HttpResponse.json({}, { status: 500 });
        }),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      const field = within(dialog).getByRole("textbox", { name: "Household name" });
      // The form opens ready to type.
      expect(field).toHaveFocus();
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(expect.stringContaining("Give your household a name."));
      // Focus goes back to the field, so the error is announced where it can be fixed.
      expect(field).toHaveFocus();
      expect(called).toBe(false);
    });

    it("shows what the API answered when creating fails", async () => {
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", () => apiError(409, "household.already_member")),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.type(within(dialog).getByRole("textbox"), "Casa Ana");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(await within(dialog).findByText(/You're already part of a household/)).toBeInTheDocument();
    });

    it("speaks Spanish", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      renderApp({ path: "/", locale: "es" });
      expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Crear un hogar" })).toBeEnabled();
    });

    it("has no accessibility violations", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      const { container } = renderApp({ path: "/" });
      await screen.findByRole("button", { name: "Create a household" });
      await expectNoA11yViolations(container);
    });
  });

  describe("with a household", () => {
    const shared = householdView({
      members: [
        member({ id: "m_ana", userId: ana.id, name: "Ana García", role: "ADMIN", shareBps: 5000 }),
        member({ id: "m_bruno", name: "Bruno Díaz", shareBps: 5000 }),
      ],
    });

    it("shows the household, its people and a way to its settings", async () => {
      server.use(handlers.signedIn(), handlers.household(shared));
      renderApp({ path: "/" });

      const section = await screen.findByRole("region", { name: "Casa Ana" });
      expect(within(section).getByText("2 people live here")).toBeInTheDocument();
      expect(within(section).getByText("Bruno Díaz")).toBeInTheDocument();
      expect(within(section).getByRole("link", { name: "Household settings" })).toHaveAttribute(
        "href",
        "/household/settings",
      );
    });

    it("asks admins to review the split when members changed", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, splitNeedsReview: true }));
      renderApp({ path: "/" });
      const notice = await screen.findByRole("status", { name: "" });
      expect(notice).toHaveTextContent("Review the split");
      expect(within(notice).getByRole("link", { name: "Review split" })).toHaveAttribute(
        "href",
        "/household/settings#split",
      );
    });

    it("doesn't bother members and guests about the split", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, myRole: "MEMBER", splitNeedsReview: true }));
      renderApp({ path: "/" });
      await screen.findByRole("region", { name: "Casa Ana" });
      expect(screen.queryByText("Review the split")).not.toBeInTheDocument();
    });

    it("offers to try again when the household can't be loaded", async () => {
      let attempts = 0;
      server.use(
        handlers.signedIn(),
        http.get("*/api/household", () => {
          attempts += 1;
          return attempts <= 2 ? apiError(500, "server.unexpected") : HttpResponse.json({ household: shared });
        }),
      );
      renderApp({ path: "/" });

      // The app retries once before giving up, so the message takes a moment.
      expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
        "We couldn't load your household.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByRole("region", { name: "Casa Ana" })).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, splitNeedsReview: true }));
      const { container } = renderApp({ path: "/" });
      await screen.findByRole("region", { name: "Casa Ana" });
      await expectNoA11yViolations(container);
    });
  });

  it("keeps a signed-in person away from the login page", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    const { router } = renderApp({ path: "/login" });
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("follows the account's language until the person picks one", async () => {
    server.use(handlers.signedIn({ ...ana, locale: "es" }), handlers.noHousehold());
    renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
  });

  it("changes the theme and signs out, forgetting the household", async () => {
    installFakeGoogle();
    server.use(handlers.signedIn(), handlers.household());
    const { router } = renderApp({ path: "/" });

    await userEvent.click(await screen.findByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset["theme"]).toBe("dark");

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Hogar" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    await waitFor(() => expect(screen.queryByText("Casa Ana")).not.toBeInTheDocument());
  });
});
