import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Dialog } from "./Dialog";

function Example({ onOpenChange = vi.fn() }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Leave household
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange(next);
        }}
        title="Leave Casa Ana?"
        description="You'll stop seeing its expenses and chores."
        closeLabel="Close"
        actions={
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        <p>Body text</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as a modal named by its title and described by its description", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Leave household" }));
    const dialog = screen.getByRole("dialog", { name: "Leave Casa Ana?" });
    expect(dialog).toHaveAccessibleDescription("You'll stop seeing its expenses and chores.");
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("moves focus inside and returns it to the trigger when closed", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Leave household" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes with Escape and with the labelled close button", async () => {
    const onOpenChange = vi.fn();
    render(<Example onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Leave household" }));
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByRole("button", { name: "Leave household" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no accessibility violations when open", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Leave household" }));
    await expectNoA11yViolations(document.body);
  });
});
