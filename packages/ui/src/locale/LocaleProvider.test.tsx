import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider, isLocale, useFormattingLocale, useLocale } from "./LocaleProvider";

function ShowLocale() {
  return <span>{useLocale()}</span>;
}

function ShowFormattingLocale() {
  return <span>{useFormattingLocale()}</span>;
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

describe("useFormattingLocale", () => {
  it("falls back to en without a provider", () => {
    render(<ShowFormattingLocale />);
    expect(screen.getByText("en")).toBeInTheDocument();
  });

  it("exposes the provided formatting locale next to the language", () => {
    render(
      <LocaleProvider locale="es" formattingLocale="es-CO">
        <ShowLocale />
        <ShowFormattingLocale />
      </LocaleProvider>,
    );
    expect(screen.getByText("es")).toBeInTheDocument();
    expect(screen.getByText("es-CO")).toBeInTheDocument();
  });

  it("formats with the language alone when no formatting locale is given", () => {
    render(
      <LocaleProvider locale="es">
        <ShowFormattingLocale />
      </LocaleProvider>,
    );
    expect(screen.getByText("es")).toBeInTheDocument();
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
