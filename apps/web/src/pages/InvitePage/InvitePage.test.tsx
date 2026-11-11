import type { ErrorCode, InvitationPreview } from "@hogar/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { apiError, handlers, householdView, server } from "../../test/server";

function preview(overrides: Partial<InvitationPreview> = {}): InvitationPreview {
  return {
    householdName: "Casa Ana",
    inviterName: "Ana García",
    role: "MEMBER",
    expiresAt: "2026-11-11T22:00:00.000Z",
    viewer: "can_join",
    ...overrides,
  };
}

const lookupReturns = (body: InvitationPreview) => http.post("*/api/invitations/lookup", () => HttpResponse.json(body));

describe("InvitePage", () => {
  it("shows who invites, to which household and as what, and joins only when asked", async () => {
    let accepted = false;
    server.use(
      handlers.signedIn(),
      lookupReturns(preview()),
      http.post("*/api/invitations/accept", async ({ request }) => {
        expect(await request.json()).toEqual({ token: "tok_123" });
        accepted = true;
        return HttpResponse.json({ household: householdView({ myRole: "MEMBER" }) });
      }),
      handlers.household(householdView({ myRole: "MEMBER" })),
    );
    const { router } = renderApp({ path: "/invite#tok_123" });

    expect(await screen.findByText("Ana García invites you to join Casa Ana as a member.")).toBeInTheDocument();
    expect(accepted).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Join Casa Ana" }));
    expect(await screen.findByRole("region", { name: "Casa Ana" })).toBeInTheDocument();
    expect(accepted).toBe(true);
    expect(router.state.location.pathname).toBe("/");
  });

  it("speaks Spanish, guest invitations included", async () => {
    server.use(handlers.signedIn(), lookupReturns(preview({ role: "GUEST" })));
    renderApp({ path: "/invite#tok", locale: "es" });
    expect(await screen.findByText("Ana García te invita a unirte a Casa Ana como invitado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unirme a Casa Ana" })).toBeInTheDocument();
  });

  it("takes members of the same household home without using the invitation", async () => {
    server.use(handlers.signedIn(), lookupReturns(preview({ viewer: "already_member" })));
    renderApp({ path: "/invite#tok" });
    expect(await screen.findByText("You're already part of Casa Ana.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my household" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
  });

  it("asks people with another household to leave it first, then lets them join", async () => {
    let viewer: InvitationPreview["viewer"] = "has_other_household";
    server.use(
      handlers.signedIn(),
      http.post("*/api/invitations/lookup", () => HttpResponse.json(preview({ viewer }))),
      http.post("*/api/household/leave", () => {
        viewer = "can_join";
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp({ path: "/invite#tok" });

    expect(await screen.findByText(/You already belong to another household/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leave my household" }));
    const dialog = await screen.findByRole("dialog", { name: "Leave your household?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave household" }));

    expect(await screen.findByRole("button", { name: "Join Casa Ana" })).toBeInTheDocument();
  });

  it.each([
    ["invitation.used", 410, /already been used/],
    ["invitation.expired", 410, /has expired/],
    ["invitation.revoked", 410, /was cancelled/],
    ["invitation.not_found", 404, /doesn't work/],
  ] as [ErrorCode, number, RegExp][])("explains a %s link kindly", async (code, status, message) => {
    server.use(
      handlers.signedIn(),
      http.post("*/api/invitations/lookup", () => apiError(status, code)),
    );
    renderApp({ path: "/invite#tok" });
    expect(await screen.findByRole("heading", { level: 1, name: "This invitation can't be used" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("treats a link without a token as one that doesn't work", async () => {
    server.use(handlers.signedIn());
    renderApp({ path: "/invite" });
    expect(await screen.findByText(/This invitation link doesn't work/)).toBeInTheDocument();
  });

  it("explains when someone else used the link first", async () => {
    server.use(
      handlers.signedIn(),
      lookupReturns(preview()),
      http.post("*/api/invitations/accept", () => apiError(410, "invitation.used")),
    );
    renderApp({ path: "/invite#tok" });
    await userEvent.click(await screen.findByRole("button", { name: "Join Casa Ana" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already been used/);
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), lookupReturns(preview()));
    const { container } = renderApp({ path: "/invite#tok" });
    await screen.findByRole("button", { name: "Join Casa Ana" });
    await expectNoA11yViolations(container);
  });
});
