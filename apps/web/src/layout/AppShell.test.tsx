import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("is one main navigation, in the header, whatever the screen size", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: "/" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(within(screen.getByRole("banner")).getByRole("navigation", { name: "Main" })).toBe(nav);
  });

  it("opens the household settings from the account menu, the same place at every size", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    const { router } = renderApp({ path: "/expenses" });
    await userEvent.click(await screen.findByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Household settings" }));
    expect(router.state.location.pathname).toBe("/household/settings");
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
