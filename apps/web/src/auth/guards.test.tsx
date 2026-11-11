import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { installFakeGoogle, renderApp } from "../test/renderApp";
import { handlers, server } from "../test/server";
import { safeReturnPath } from "./guards";

describe("safeReturnPath", () => {
  it.each([
    ["/invite#abc", "/invite#abc"],
    ["/household/settings", "/household/settings"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    [undefined, "/"],
    [42, "/"],
  ])("%s → %s", (from, expected) => {
    expect(safeReturnPath(from)).toBe(expected);
  });
});

describe("returning after sign-in", () => {
  it("sends an anonymous visitor to the login page and back to the invitation, #token included", async () => {
    installFakeGoogle();
    server.use(
      handlers.googleLogin(),
      http.post("*/api/invitations/lookup", async ({ request }) => {
        expect(await request.json()).toEqual({ token: "abc123" });
        return HttpResponse.json({
          householdName: "Casa Ana",
          inviterName: "Ana García",
          role: "MEMBER",
          expiresAt: "2026-11-11T22:00:00.000Z",
          viewer: "can_join",
        });
      }),
    );
    const { router } = renderApp({ path: "/invite#abc123" });

    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Hogar" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");

    await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("heading", { level: 1, name: "You've been invited" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/invite");
    expect(router.state.location.hash).toBe("#abc123");
  });

  it("goes home after a plain sign-in", async () => {
    installFakeGoogle();
    server.use(handlers.googleLogin(), handlers.noHousehold());
    const { router } = renderApp({ path: "/login" });
    await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    expect(router.state.location.pathname).toBe("/");
  });
});
