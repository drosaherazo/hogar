import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("is announced as a status with its label", () => {
    render(<Spinner label="Loading your home" />);
    expect(screen.getByRole("status", { name: "Loading your home" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Spinner label="Cargando" size="lg" />);
    await expectNoA11yViolations(container);
  });
});
