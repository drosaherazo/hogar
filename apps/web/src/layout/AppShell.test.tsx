import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/renderApp";
import { handlers, homeView, server } from "../test/server";

describe("AppShell navigation", () => {
  it("offers Home and Expenses once there is a household, marking the current page", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Expenses" })).toHaveAttribute("href", "/expenses");
    expect(within(nav).getByRole("link", { name: "Expenses" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Expenses marked on the balances, which belong to the same section", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/balances" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "true");
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("has nothing to navigate to without a household", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    renderApp({ path: "/" });
    await screen.findByRole("button", { name: "Create a household" });
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });
});
