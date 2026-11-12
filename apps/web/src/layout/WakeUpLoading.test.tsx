import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue, AuthState, WaitPhase } from "../auth/AuthProvider";
import { createI18n } from "../i18n";
import { WakeUpLoading } from "./WakeUpLoading";

const retry = vi.fn();
let state: AuthState;

vi.mock("../auth/AuthProvider", () => ({
  useAuth: (): AuthContextValue => ({
    state,
    retry,
    loginWithGoogle: vi.fn(),
    signInWithEmailCode: vi.fn(),
    logout: vi.fn(),
  }),
}));

const START = Date.parse("2026-11-11T10:00:00Z");

function waitingState(phase: WaitPhase = "waking", attempt = 0): AuthState {
  return { status: "loading", user: null, phase, startedAt: START, attempt };
}

function renderLoading(lng: "en" | "es" = "en") {
  return render(
    <I18nextProvider i18n={createI18n({ lng })}>
      <WakeUpLoading />
    </I18nextProvider>,
  );
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const heading = () => screen.queryByRole("heading", { level: 1 })?.textContent;

describe("WakeUpLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    state = waitingState();
    retry.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("waking", () => {
    it("keeps the page calm and empty for the first second", async () => {
      renderLoading();
      expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
      expect(heading()).toBeUndefined();
      expect(document.querySelector("svg")).toBeNull();
      await advance(999);
      expect(heading()).toBeUndefined();
    });

    it("puts the first status into a live region that was already on the page", async () => {
      renderLoading();
      const region = screen.getByRole("status");
      expect(region).toBeEmptyDOMElement();
      await advance(1000);
      expect(screen.getByRole("status")).toBe(region);
      expect(region).toHaveTextContent("Knocking on your home's door…");
    });

    it("keeps the same live region when waking turns into taking longer than usual", async () => {
      const { rerender } = renderLoading();
      await advance(1000);
      const region = screen.getByRole("status");
      state = waitingState("slow");
      rerender(
        <I18nextProvider i18n={createI18n({ lng: "en" })}>
          <WakeUpLoading />
        </I18nextProvider>,
      );
      expect(screen.getByRole("status")).toBe(region);
      expect(region).toHaveTextContent("This is taking longer than usual");
    });

    it("explains the wait from the first second on, with honest stages", async () => {
      renderLoading();
      await advance(1000);
      expect(heading()).toBe("Knocking on your home's door…");
      expect(screen.getByText(/Hogar takes a nap when nobody's around/)).toBeInTheDocument();
      await advance(14_000);
      expect(heading()).toBe("Turning on the lights…");
      await advance(20_000);
      expect(heading()).toBe("Almost there, putting the kettle on…");
      await advance(45_000);
      expect(heading()).toBe("Almost there, putting the kettle on…");
    });

    it("shows the scene straight away on a later attempt", () => {
      state = waitingState("waking", 1);
      renderLoading();
      expect(heading()).toBe("Knocking on your home's door…");
    });

    it("follows the clock, not the number of ticks (a tab coming back from the background)", async () => {
      renderLoading();
      await act(async () => {
        vi.setSystemTime(START + 20_000);
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(heading()).toBe("Turning on the lights…");
    });

    it("speaks Spanish when the app does", async () => {
      renderLoading("es");
      await advance(1000);
      expect(heading()).toBe("Llamando a la puerta de tu hogar…");
      expect(screen.getByText("Un consejo")).toBeInTheDocument();
    });
  });

  describe("tips", () => {
    it("starts with the first tip and moves on every seven seconds", async () => {
      renderLoading();
      await advance(1000);
      expect(screen.getByText("Quick tip")).toBeInTheDocument();
      expect(
        screen.getByText("Invite the people you live with by sharing a link. No emails needed."),
      ).toBeInTheDocument();
      await advance(7000);
      expect(screen.queryByText("Invite the people you live with by sharing a link. No emails needed.")).toBeNull();
    });

    it("shows ten different tips before repeating one, and never inside the live status", async () => {
      renderLoading();
      const seen = new Set<string>();
      await advance(1000);
      for (let step = 0; step < 10; step += 1) {
        const tip = screen.getByText("Quick tip").nextElementSibling?.textContent ?? "";
        expect(screen.getByRole("status")).not.toHaveTextContent(tip);
        seen.add(tip);
        await advance(7000);
      }
      expect(seen.size).toBe(10);
    });

    it("jumps to the right tip after a long time in the background", async () => {
      renderLoading();
      await act(async () => {
        vi.setSystemTime(START + 1000 + 7000 * 4);
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(
        screen.getByText("Paid someone back? Record the payment and everyone's balance updates."),
      ).toBeInTheDocument();
    });
  });

  describe("when waking goes wrong", () => {
    it("offers to try again when it takes too long", async () => {
      vi.useRealTimers();
      state = waitingState("slow");
      renderLoading();
      expect(heading()).toBe("This is taking longer than usual");
      expect(screen.getByText("Your home may still be waking up. Give it another go in a moment.")).toBeInTheDocument();
      expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
      expect(screen.queryByText("Quick tip")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(retry).toHaveBeenCalledOnce();
    });

    it("says the device is offline, with nothing to press", () => {
      state = waitingState("offline");
      renderLoading();
      expect(heading()).toBe("You seem to be offline");
      expect(screen.getByText("We'll carry on as soon as you're back online.")).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByText("Quick tip")).toBeNull();
      expect(screen.getByRole("main")).not.toHaveAttribute("aria-busy");
    });
  });
});
