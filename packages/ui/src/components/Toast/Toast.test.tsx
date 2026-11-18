import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { TOAST_TIMEOUT_MS, ToastQueue, ToastRegion } from "./Toast";

function Example({ onUndo = vi.fn(), actionDisabled }: { onUndo?: (name: string) => void; actionDisabled?: boolean }) {
  const [queue] = useState(() => new ToastQueue());
  const remove = (name: string) =>
    queue.show({ message: `You deleted ${name}`, action: { label: "Undo", onAction: () => onUndo(name) } });
  return (
    <>
      <button type="button" onClick={() => remove("Milk")}>
        Delete Milk
      </button>
      <button type="button" onClick={() => remove("Eggs")}>
        Delete Eggs
      </button>
      <p id="offline-reason">Changes are available when you're back online.</p>
      <ToastRegion
        queue={queue}
        label="Notifications"
        closeLabel="Close"
        actionDisabled={actionDisabled}
        actionDescribedBy={actionDisabled ? "offline-reason" : undefined}
      />
    </>
  );
}

const region = () => screen.getByRole("region", { name: "Notifications" });

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("says what happened, in a labelled region, and shows nothing before that", async () => {
    render(<Example />);
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));

    const toast = within(region()).getByRole("alertdialog", { name: "You deleted Milk" });
    expect(within(toast).getByRole("alert")).toHaveTextContent("You deleted Milk");
  });

  it("runs its action once and closes", async () => {
    const onUndo = vi.fn();
    render(<Example onUndo={onUndo} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));

    await userEvent.click(within(region()).getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledExactlyOnceWith("Milk");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("closes with its labelled close button without running the action", async () => {
    const onUndo = vi.fn();
    render(<Example onUndo={onUndo} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));

    await userEvent.click(within(region()).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("goes away by itself after a few seconds", () => {
    vi.useFakeTimers();
    render(<Example />);
    act(() => screen.getByRole("button", { name: "Delete Milk" }).click());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows one at a time: a new one replaces the last, so its action is always about the latest", async () => {
    const onUndo = vi.fn();
    render(<Example onUndo={onUndo} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Eggs" }));

    expect(
      within(region())
        .getAllByRole("alertdialog")
        .map((toast) => toast.textContent),
    ).toEqual([expect.stringContaining("You deleted Eggs")]);
    await userEvent.click(within(region()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("can switch its action off, saying why", async () => {
    const onUndo = vi.fn();
    render(<Example onUndo={onUndo} actionDisabled />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));

    const undo = within(region()).getByRole("button", { name: "Undo" });
    expect(undo).toBeDisabled();
    expect(undo).toHaveAccessibleDescription("Changes are available when you're back online.");
  });

  it("has no accessibility violations while showing", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Milk" }));
    await expectNoA11yViolations(document.body);
  });
});
