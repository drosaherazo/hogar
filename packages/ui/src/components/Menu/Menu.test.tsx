import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Menu, MenuItem, MenuRadioGroup, MenuSeparator } from "./Menu";

function AccountMenu({ onSignOut = vi.fn() }: { onSignOut?: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <Menu trigger={<button type="button">Account</button>}>
      <MenuRadioGroup
        label="Theme"
        value={theme}
        onValueChange={setTheme}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <MenuSeparator />
      <MenuItem onSelect={onSignOut}>Sign out</MenuItem>
    </Menu>
  );
}

describe("Menu", () => {
  it("opens from its trigger and runs the selected action", async () => {
    const onSignOut = vi.fn();
    render(<AccountMenu onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is keyboard accessible", async () => {
    render(<AccountMenu />);
    screen.getByRole("button", { name: "Account" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Account" })).toHaveFocus();
  });

  it("marks the checked option in a radio group", async () => {
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(await screen.findByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(await screen.findByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("has no accessibility violations when open", async () => {
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    await screen.findByRole("menu");
    await expectNoA11yViolations(document.body);
  });
});
