import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Button } from "../Button/Button";
import { WakeUpScreen } from "./WakeUpScreen";

const waking = {
  status: "Knocking on your home's door…",
  description: "Waking up can take up to a minute.",
};

describe("WakeUpScreen", () => {
  it("announces the status as the page heading, and keeps the description out of the live region", () => {
    render(<WakeUpScreen {...waking} />);
    const status = screen.getByRole("status");
    expect(status).toContainElement(screen.getByRole("heading", { level: 1, name: waking.status }));
    expect(status).not.toHaveTextContent(waking.description);
    expect(screen.getByText(waking.description)).toBeInTheDocument();
  });

  it("keeps an empty live region on the page until revealed, so the first status is announced", () => {
    const { container, rerender } = render(<WakeUpScreen {...waking} revealed={false} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByText(waking.description)).toBeNull();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");

    rerender(<WakeUpScreen {...waking} revealed />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toContainElement(screen.getByRole("heading", { level: 1, name: waking.status }));
  });

  it("has no accessibility violations before it is revealed", async () => {
    const { container } = render(<WakeUpScreen {...waking} revealed={false} />);
    await expectNoA11yViolations(container);
  });

  it("is busy while waking and not while resting", () => {
    const { rerender } = render(<WakeUpScreen {...waking} />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    rerender(<WakeUpScreen {...waking} mood="resting" />);
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
  });

  it("hides the decorative illustration and only animates it while waking", () => {
    const { container, rerender } = render(<WakeUpScreen {...waking} />);
    const illustration = container.querySelector("svg");
    expect(illustration).toHaveAttribute("aria-hidden", "true");
    expect(illustration?.getAttribute("class")).toMatch(/animated/);
    rerender(<WakeUpScreen {...waking} mood="resting" />);
    expect(container.querySelector("svg")?.getAttribute("class")).not.toMatch(/animated/);
  });

  it("shows the tip outside any live region and replaces it when it changes", () => {
    const { rerender } = render(<WakeUpScreen {...waking} tipLabel="Quick tip" tip="First tip" />);
    const first = screen.getByText("First tip");
    expect(screen.getByText("Quick tip")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("First tip");
    expect(first.closest("[aria-live]")).toBeNull();

    rerender(<WakeUpScreen {...waking} tipLabel="Quick tip" tip="Second tip" />);
    expect(screen.getByText("Second tip")).not.toBe(first);
    expect(first).not.toBeInTheDocument();
  });

  it("offers its action to keyboard users", async () => {
    render(
      <WakeUpScreen status="This is taking longer than usual" mood="resting" action={<Button>Try again</Button>} />,
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
  });

  it.each([
    [
      "waking with a tip",
      <WakeUpScreen key="waking" {...waking} tipLabel="Quick tip" tip="Invite people with a link." />,
    ],
    [
      "slow, with an action",
      <WakeUpScreen
        key="slow"
        status="This is taking longer than usual"
        description="Give it another go in a moment."
        mood="resting"
        action={<Button>Try again</Button>}
      />,
    ],
    [
      "offline",
      <WakeUpScreen
        key="offline"
        status="You seem to be offline"
        description="We'll carry on as soon as you're back online."
        mood="resting"
      />,
    ],
  ])("has no accessibility violations (%s)", async (_name, element) => {
    const { container } = render(element);
    await expectNoA11yViolations(container);
  });
});
