import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { installFakeGoogle, renderApp } from "../../test/renderApp";
import { handlers, server } from "../../test/server";

describe("LoginPage", () => {
  it("sends anonymous visitors to the login page", async () => {
    installFakeGoogle();
    const { router } = renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Hogar" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(screen.getByText("We only use your name, email and photo from Google.")).toBeInTheDocument();
  });

  it("signs in with Google and lands on the home page", async () => {
    installFakeGoogle();
    server.use(handlers.googleLogin());
    const { router } = renderApp({ path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hi, Ana" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("explains a failed sign-in in the person's language", async () => {
    installFakeGoogle();
    server.use(handlers.googleLoginFails("auth.google.email_not_verified"));
    renderApp({ path: "/login", locale: "es" });
    await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El email de tu cuenta de Google aún no está verificado.",
    );
  });

  it.each([
    ["en", "This email already signs in with another Google account. Use that one, or get a code by email."],
    ["es", "Este email ya entra con otra cuenta de Google. Usa esa o pide un código por email."],
  ] as const)(
    "suggests a code when the address already signs in with another Google account (%s)",
    async (locale, text) => {
      installFakeGoogle();
      server.use(handlers.googleLoginFails("auth.google.already_linked"));
      renderApp({ path: "/login", locale });
      await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(text);
    },
  );

  it("tells developers when the Google Client ID is missing", async () => {
    renderApp({ path: "/login", googleClientId: undefined });
    expect(await screen.findByRole("alert")).toHaveTextContent("VITE_GOOGLE_CLIENT_ID");
  });

  it("switches language and theme from the footer", async () => {
    installFakeGoogle();
    renderApp({ path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "Español" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Te damos la bienvenida a Hogar" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("hogar-language")).toBe("es");

    await userEvent.click(screen.getByRole("button", { name: "Cambiar al tema oscuro" }));
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(localStorage.getItem("hogar-theme")).toBe("dark");
  });

  it("has no accessibility violations", async () => {
    installFakeGoogle();
    const { container } = renderApp({ path: "/login" });
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument());
    await expectNoA11yViolations(container);
  });
});
