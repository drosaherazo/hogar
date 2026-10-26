import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider, isLocale, useLocale } from "./LocaleProvider";

function ShowLocale() {
  return <span>{useLocale()}</span>;
}

describe("LocaleProvider", () => {
  it("falls back to en without a provider", () => {
    render(<ShowLocale />);
    expect(screen.getByText("en")).toBeInTheDocument();
  });

  it("exposes the provided locale", () => {
    render(
      <LocaleProvider locale="es">
        <ShowLocale />
      </LocaleProvider>,
    );
    expect(screen.getByText("es")).toBeInTheDocument();
  });

  it("uses the nearest provider", () => {
    render(
      <LocaleProvider locale="es">
        <LocaleProvider locale="en">
          <ShowLocale />
        </LocaleProvider>
      </LocaleProvider>,
    );
    expect(screen.getByText("en")).toBeInTheDocument();
  });
});

describe("isLocale", () => {
  it("accepts supported locales only", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
