import { act, render, screen } from "@testing-library/react";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons, mockChannel } from "storybook/preview-api";
import { beforeEach, describe, expect, it } from "vitest";
import { Lang, useLocalized } from "./locale";

function Page() {
  const greeting = useLocalized({ en: "Hello", es: "Hola" });
  return (
    <>
      <p>{greeting}</p>
      <Lang locale="en">
        <p>English prose</p>
      </Lang>
      <Lang locale="es">
        <p>Texto en español</p>
      </Lang>
    </>
  );
}

describe("docs locale", () => {
  beforeEach(() => {
    addons.setChannel(mockChannel());
    document.documentElement.lang = "";
  });

  it("falls back to en when no globals were emitted", () => {
    render(<Page />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("English prose")).toBeInTheDocument();
    expect(screen.queryByText("Texto en español")).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("reads the locale already set before the page mounted", () => {
    addons.getChannel().emit(SET_GLOBALS, { globals: { locale: "es" } });
    render(<Page />);
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("Texto en español")).toBeInTheDocument();
  });

  it("switches language when the toolbar changes", () => {
    render(<Page />);
    act(() => {
      addons.getChannel().emit(GLOBALS_UPDATED, { globals: { locale: "es" } });
    });
    expect(screen.getByText("Texto en español")).toBeInTheDocument();
    expect(screen.queryByText("English prose")).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
  });

  it("ignores unsupported locales", () => {
    render(<Page />);
    act(() => {
      addons.getChannel().emit(GLOBALS_UPDATED, { globals: { locale: "fr" } });
    });
    expect(screen.getByText("English prose")).toBeInTheDocument();
  });
});
