import type { InvitationView } from "@hogar/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { apiError, handlers, householdView, server } from "../../test/server";

const PATH = "/household/settings";
const inTwelveHours = () => new Date(Date.now() + 12 * 60 * 60 * 1000 - 1000).toISOString();

function invitation(overrides: Partial<InvitationView> = {}): InvitationView {
  return {
    id: "inv_1",
    role: "MEMBER",
    createdByName: "Ana García",
    expiresAt: inTwelveHours(),
    status: "pending",
    ...overrides,
  };
}

const listReturns = (invitations: InvitationView[]) =>
  http.get("*/api/household/invitations", () => HttpResponse.json({ invitations }));

async function section() {
  return screen.findByRole("region", { name: "Invitations" });
}

describe("InvitationsSection", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("creates a link for the chosen role and shows it once, ready to copy", async () => {
    let invitations: InvitationView[] = [];
    server.use(
      handlers.signedIn(),
      handlers.household(),
      http.get("*/api/household/invitations", () => HttpResponse.json({ invitations })),
      http.post("*/api/household/invitations", async ({ request }) => {
        expect(await request.json()).toEqual({ role: "GUEST" });
        const created = invitation({ role: "GUEST" });
        invitations = [created];
        return HttpResponse.json({ invitation: created, token: "tok_secret" }, { status: 201 });
      }),
    );
    renderApp({ path: PATH });

    const region = await section();
    expect(await within(region).findByText("No open invitations right now.")).toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: "Invite someone" }));

    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    expect(within(dialog).getByRole("radio", { name: /Member/ })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("radio", { name: /Guest/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create link" }));

    const linkDialog = await screen.findByRole("dialog", { name: "Your invitation link" });
    const link = within(linkDialog).getByRole("textbox", { name: "Invitation link" });
    expect(link).toHaveValue(`${window.location.origin}/invite#tok_secret`);
    await userEvent.click(within(linkDialog).getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite#tok_secret`);
    expect(within(linkDialog).getByRole("status")).toHaveTextContent("Link copied.");

    await userEvent.click(within(linkDialog).getByRole("button", { name: "Done" }));
    expect(await within(region).findByText("Guest")).toBeInTheDocument();
    expect(within(region).getByText("Expires in 12 hours")).toBeInTheDocument();
    expect(within(region).getByText("Created by Ana García")).toBeInTheDocument();
  });

  it("helps copy by hand when the clipboard isn't available", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    server.use(
      handlers.signedIn(),
      handlers.household(),
      listReturns([]),
      http.post("*/api/household/invitations", () =>
        HttpResponse.json({ invitation: invitation(), token: "tok" }, { status: 201 }),
      ),
    );
    renderApp({ path: PATH });
    await userEvent.click(within(await section()).getByRole("button", { name: "Invite someone" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create link" }));
    const linkDialog = await screen.findByRole("dialog", { name: "Your invitation link" });
    await userEvent.click(within(linkDialog).getByRole("button", { name: "Copy link" }));
    expect(within(linkDialog).getByRole("status")).toHaveTextContent("Select the link and copy it.");
  });

  it("replaces a lost or expired link with a new one in one click", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(),
      listReturns([invitation({ id: "inv_old", status: "expired", expiresAt: "2026-11-01T00:00:00.000Z" })]),
      http.post("*/api/household/invitations/inv_old/renew", () =>
        HttpResponse.json({ invitation: invitation({ id: "inv_new" }), token: "tok_new" }, { status: 201 }),
      ),
    );
    renderApp({ path: PATH });

    const region = await section();
    expect(await within(region).findByText("Expired")).toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: "New link" }));
    const linkDialog = await screen.findByRole("dialog", { name: "Your invitation link" });
    expect(within(linkDialog).getByRole("textbox")).toHaveValue(`${window.location.origin}/invite#tok_new`);
  });

  it("asks before revoking and then removes the invitation", async () => {
    let invitations = [invitation()];
    server.use(
      handlers.signedIn(),
      handlers.household(),
      http.get("*/api/household/invitations", () => HttpResponse.json({ invitations })),
      http.delete("*/api/household/invitations/inv_1", () => {
        invitations = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp({ path: PATH });

    const region = await section();
    await userEvent.click(await within(region).findByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog", { name: "Revoke this invitation?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke invitation" }));
    expect(await within(region).findByText("No open invitations right now.")).toBeInTheDocument();
  });

  it("explains the limit of open invitations", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(),
      listReturns([]),
      http.post("*/api/household/invitations", () => apiError(409, "invitation.limit_reached")),
    );
    renderApp({ path: PATH });
    await userEvent.click(within(await section()).getByRole("button", { name: "Invite someone" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("You already have 10 open invitations.");
  });

  it("isn't shown to members or guests", async () => {
    server.use(handlers.signedIn(), handlers.household(householdView({ myRole: "MEMBER" })));
    renderApp({ path: PATH });
    await screen.findByRole("region", { name: "Name" });
    expect(screen.queryByRole("region", { name: "Invitations" })).not.toBeInTheDocument();
  });

  it("speaks Spanish", async () => {
    server.use(handlers.signedIn(), handlers.household(), listReturns([invitation()]));
    renderApp({ path: PATH, locale: "es" });
    const region = await screen.findByRole("region", { name: "Invitaciones" });
    expect(await within(region).findByText("Caduca dentro de 12 horas")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Nuevo enlace" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(), listReturns([invitation()]));
    const { container } = renderApp({ path: PATH });
    await within(await section()).findByText("Expires in 12 hours");
    await expectNoA11yViolations(container);
  });
});
