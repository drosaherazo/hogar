import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { installFakeGoogle, renderApp } from "../../test/renderApp";
import { ana, handlers, server } from "../../test/server";
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
  it("restores the session and greets the person by their first name", async () => {
    server.use(handlers.signedIn());
    renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hi, Ana" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "You're not part of a household yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a household" })).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn());
    renderApp({ path: "/", locale: "es" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear un hogar" })).toBeDisabled();
  });

  it("follows the account's language until the person picks one", async () => {
    server.use(handlers.signedIn({ ...ana, locale: "es" }));
    renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
  });

  it("keeps a signed-in person away from the login page", async () => {
    server.use(handlers.signedIn());
    const { router } = renderApp({ path: "/login" });
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("changes the theme and signs out from the account menu", async () => {
    installFakeGoogle();
    server.use(handlers.signedIn());
    const { router } = renderApp({ path: "/" });

    await userEvent.click(await screen.findByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset["theme"]).toBe("dark");

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Hogar" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn());
    const { container } = renderApp({ path: "/" });
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    await expectNoA11yViolations(container);
  });
});
