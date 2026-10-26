import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./server";

// jsdom has no matchMedia; the theme code reads the system preference through it.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  server.listen({ onUnhandledFrame: "error" });
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  delete window.google;
});

afterAll(() => {
  server.close();
});
