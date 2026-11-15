import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api/client";
import { createI18n } from "../i18n";
import { expectNoA11yViolations } from "../test/axe";
import { renderApp } from "../test/renderApp";
import { apiError, handlers, homeView, server } from "../test/server";
import { RequiredUpdateGate } from "./RequiredUpdate";

const BASE = "http://localhost/api";
const outdated = () => apiError(426, "client.outdated");

function renderGate(client: ApiClient, onUpdate = vi.fn(), lng: "en" | "es" = "en") {
  render(
    <I18nextProvider i18n={createI18n({ lng })}>
      <RequiredUpdateGate client={client} onUpdate={onUpdate}>
        <p>Your household</p>
      </RequiredUpdateGate>
    </I18nextProvider>,
  );
  return onUpdate;
}

describe("Required update", () => {
  it("replaces the app when the server says this version is outdated while starting", async () => {
    server.use(http.post("*/api/auth/refresh", outdated));
    renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hogar has been updated" })).toBeInTheDocument();
    expect(screen.getByText("Update to keep going. Anything you hadn't saved can't be kept.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("replaces the page in use, whatever request found out", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/" });
    await screen.findByRole("navigation", { name: "Main" });
    server.use(http.get("*/api/household/activity", outdated), http.get("*/api/household", outdated));
    await userEvent.click(screen.getByRole("link", { name: "Expenses" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Hogar has been updated" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("shows the screen even when the client found out before the gate was there", async () => {
    server.use(http.get("*/api/me", outdated));
    const client = new ApiClient(BASE);
    await client.me().catch(() => undefined);
    renderGate(client);
    expect(await screen.findByRole("heading", { name: "Hogar has been updated" })).toBeInTheDocument();
    expect(screen.queryByText("Your household")).not.toBeInTheDocument();
  });

  it("updates with its only button, and can't be dismissed", async () => {
    server.use(http.get("*/api/me", outdated));
    const client = new ApiClient(BASE);
    const onUpdate = renderGate(client);
    expect(screen.getByText("Your household")).toBeInTheDocument();
    await client.me().catch(() => undefined);
    await screen.findByRole("heading", { name: "Hogar has been updated" });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "Hogar has been updated" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Update" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("speaks Spanish and passes axe", async () => {
    server.use(http.get("*/api/me", outdated));
    const client = new ApiClient(BASE);
    await client.me().catch(() => undefined);
    renderGate(client, vi.fn(), "es");
    await screen.findByRole("heading", { name: "Hogar se ha actualizado" });
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    await expectNoA11yViolations(document.body);
  });
});
