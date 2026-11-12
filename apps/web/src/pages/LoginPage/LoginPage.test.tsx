import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
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

describe("LoginPage: signing in with a code", () => {
  async function askForCode(email = "lucia@example.com") {
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), email);
    await userEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  }

  it("sends a code in the page's language and signs in with it, spaces included", async () => {
    installFakeGoogle();
    const requests: unknown[] = [];
    server.use(
      handlers.emailCode((body) => requests.push(body)),
      handlers.emailSignIn("482913"),
    );
    const { router } = renderApp({ path: "/login" });

    await askForCode("  Lucia@Example.com ");
    expect(await screen.findByRole("heading", { level: 2, name: "Check your email" })).toBeInTheDocument();
    expect(requests).toEqual([{ email: "lucia@example.com", locale: "en" }]);
    expect(
      screen.getByText("We sent a 6-digit code to lucia@example.com. It works for 10 minutes."),
    ).toBeInTheDocument();
    expect(screen.getByText("Can't find it? Check your spam folder.")).toBeInTheDocument();

    const codeField = screen.getByRole("textbox", { name: "Code" });
    expect(codeField).toHaveFocus();
    expect(codeField).toHaveAttribute("inputmode", "numeric");
    expect(codeField).toHaveAttribute("autocomplete", "one-time-code");

    await userEvent.type(codeField, "482 913");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hi, Ana" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("explains a badly formed address next to the field without sending anything", async () => {
    installFakeGoogle();
    const requests: unknown[] = [];
    server.use(handlers.emailCode((body) => requests.push(body)));
    renderApp({ path: "/login", locale: "es" });

    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@");
    await userEvent.click(screen.getByRole("button", { name: "Envíame un código" }));

    const field = screen.getByRole("textbox", { name: "Email" });
    expect(field).toHaveAccessibleDescription("Eso no parece un email. Revísalo y vuelve a intentarlo.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
    expect(requests).toHaveLength(0);
  });

  it.each([
    [
      "en",
      429,
      "auth.code.daily_limit",
      "You've asked for a lot of codes today. Try again tomorrow, or continue with Google.",
    ],
    [
      "es",
      503,
      "auth.email.send_failed",
      "Ahora mismo no hemos podido enviar el email. Inténtalo de nuevo en un momento.",
    ],
    ["es", 429, "auth.code.too_soon", "Espera un momento antes de pedir otro código."],
  ] as const)("explains a failed send next to the email field (%s, %s)", async (locale, status, code, text) => {
    installFakeGoogle();
    server.use(handlers.emailCodeFails(status, code, 30));
    renderApp({ path: "/login", locale });
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: locale === "es" ? "Envíame un código" : "Email me a code" }),
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(text));
  });

  it.each([
    ["en", 401, "auth.code.wrong", "That code isn't right. Check the email and try again."],
    ["es", 401, "auth.code.wrong", "Ese código no es correcto. Revisa el email y vuelve a intentarlo."],
    ["en", 401, "auth.code.expired", "This code doesn't work anymore. Ask for a new one and you're in."],
    ["es", 401, "auth.code.expired", "Este código ya no funciona. Pide uno nuevo y listo."],
  ] as const)(
    "explains a code that doesn't work next to the code field (%s, %s)",
    async (locale, status, code, text) => {
      installFakeGoogle();
      server.use(handlers.emailCode(), handlers.emailSignInFails(status, code));
      renderApp({ path: "/login", locale });
      await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@example.com");
      await userEvent.click(
        screen.getByRole("button", { name: locale === "es" ? "Envíame un código" : "Email me a code" }),
      );
      const codeField = await screen.findByRole("textbox", { name: locale === "es" ? "Código" : "Code" });
      await userEvent.type(codeField, "111111");
      await userEvent.click(screen.getByRole("button", { name: locale === "es" ? "Entrar" : "Sign in" }));
      await waitFor(() => expect(codeField).toHaveAccessibleDescription(expect.stringContaining(text)));
      expect(codeField).toHaveAttribute("aria-invalid", "true");
    },
  );

  it.each([
    ["en", "The code has 6 digits."],
    ["es", "El código tiene 6 dígitos."],
  ] as const)("explains a code without 6 digits before sending it (%s)", async (locale, text) => {
    installFakeGoogle();
    server.use(handlers.emailCode());
    renderApp({ path: "/login", locale });
    await userEvent.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: locale === "es" ? "Envíame un código" : "Email me a code" }),
    );
    const codeField = await screen.findByRole("textbox", { name: locale === "es" ? "Código" : "Code" });
    await userEvent.type(codeField, "4829");
    await userEvent.click(screen.getByRole("button", { name: locale === "es" ? "Entrar" : "Sign in" }));
    expect(codeField).toHaveAccessibleDescription(expect.stringContaining(text));
  });

  it("counts down before a new code can be sent, then sends one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      installFakeGoogle();
      const requests: unknown[] = [];
      server.use(handlers.emailCode((body) => requests.push(body)));
      renderApp({ path: "/login" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@example.com");
      await user.click(screen.getByRole("button", { name: "Email me a code" }));

      const waiting = await screen.findByRole("button", { name: "You can ask for a new code in 60 sec" });
      expect(waiting).toBeDisabled();
      act(() => vi.advanceTimersByTime(20_000));
      expect(screen.getByRole("button", { name: "You can ask for a new code in 40 sec" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(40_000));

      await user.click(await screen.findByRole("button", { name: "Send me a new code" }));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(await screen.findByRole("button", { name: "You can ask for a new code in 60 sec" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts down from the server's Retry-After when a new code is asked for too soon", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      installFakeGoogle();
      server.use(handlers.emailCode());
      renderApp({ path: "/login" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(await screen.findByRole("textbox", { name: "Email" }), "lucia@example.com");
      await user.click(screen.getByRole("button", { name: "Email me a code" }));
      await screen.findByRole("heading", { level: 2, name: "Check your email" });
      act(() => vi.advanceTimersByTime(60_000));

      server.use(handlers.emailCodeFails(429, "auth.code.too_soon", 1500));
      await user.click(await screen.findByRole("button", { name: "Send me a new code" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Hang on a moment before asking for another code.");
      expect(screen.getByRole("button", { name: "You can ask for a new code in 1,500 sec" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts down on the email step when the first code is asked for too soon, for that address only", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      installFakeGoogle();
      server.use(handlers.emailCodeFails(429, "auth.code.too_soon", 42));
      renderApp({ path: "/login" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const field = await screen.findByRole("textbox", { name: "Email" });
      await user.type(field, "lucia@example.com");
      await user.click(screen.getByRole("button", { name: "Email me a code" }));

      expect(await screen.findByText("Hang on a moment before asking for another code.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "You can ask for a new code in 42 sec" })).toBeDisabled();

      await user.clear(field);
      await user.type(field, "ana@example.com");
      expect(screen.getByRole("button", { name: "Email me a code" })).toBeEnabled();
      await user.clear(field);
      await user.type(field, "Lucia@Example.com ");
      expect(screen.getByRole("button", { name: /You can ask for a new code in/ })).toBeDisabled();

      act(() => vi.advanceTimersByTime(42_000));
      expect(screen.getByRole("button", { name: "Email me a code" })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes back to change the address, keeping what was typed", async () => {
    installFakeGoogle();
    server.use(handlers.emailCode());
    renderApp({ path: "/login" });
    await askForCode();
    await userEvent.click(await screen.findByRole("button", { name: "Use a different email" }));
    const field = screen.getByRole("textbox", { name: "Email" });
    expect(field).toHaveValue("lucia@example.com");
    expect(field).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: "Code" })).not.toBeInTheDocument();
  });

  it("returns to the invitation the visitor came from after signing in with a code", async () => {
    installFakeGoogle();
    server.use(
      handlers.emailCode(),
      handlers.emailSignIn("482913"),
      http.post("*/api/invitations/lookup", () =>
        HttpResponse.json({
          householdName: "Casa Ana",
          inviterName: "Ana García",
          role: "MEMBER",
          expiresAt: "2026-11-11T22:00:00.000Z",
          viewer: "can_join",
        }),
      ),
    );
    const { router } = renderApp({ path: "/invite#abc123" });
    await askForCode();
    await userEvent.type(await screen.findByRole("textbox", { name: "Code" }), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { level: 1, name: "You've been invited" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    expect(router.state.location.hash).toBe("#abc123");
  });

  it("has no accessibility violations on the code step", async () => {
    installFakeGoogle();
    server.use(handlers.emailCode());
    const { container } = renderApp({ path: "/login" });
    await askForCode();
    await screen.findByRole("textbox", { name: "Code" });
    await expectNoA11yViolations(container);
  });
});
