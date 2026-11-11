import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Alert } from "./Alert";

describe("Alert", () => {
  it("announces info and warnings politely, as a status", () => {
    render(
      <>
        <Alert tone="info">You're no longer part of Casa Ana.</Alert>
        <Alert tone="warning" title="Review the split">
          Carla joined.
        </Alert>
      </>,
    );
    const [info, warning] = screen.getAllByRole("status");
    expect(info).toHaveTextContent("You're no longer part of Casa Ana.");
    expect(warning).toHaveTextContent("Review the split");
    expect(warning).toHaveTextContent("Carla joined.");
  });

  it("announces problems right away, as an alert", () => {
    render(<Alert tone="danger">This invitation has expired.</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("This invitation has expired.");
  });

  it("always shows an icon with the text, so color never carries the meaning alone", () => {
    const { container } = render(<Alert tone="warning">Carla joined.</Alert>);
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders an optional action", () => {
    render(
      <Alert tone="warning" action={<button type="button">Review</button>}>
        Carla joined.
      </Alert>,
    );
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });

  it("has no accessibility violations in any tone", async () => {
    const { container } = render(
      <>
        <Alert tone="info">Info</Alert>
        <Alert tone="warning" title="Title">
          Warning
        </Alert>
        <Alert tone="danger">Danger</Alert>
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
