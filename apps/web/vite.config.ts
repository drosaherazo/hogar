/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { E2E_SOCKET_PATH, E2E_SOCKET_PORT } from "./cypress/socketStub.ts";
import { pwaOptions } from "./pwa.config.ts";

export default defineConfig(({ mode }) => ({
  plugins: [react(), VitePWA(pwaOptions)],
  server: {
    port: 5173,
    strictPort: true,
    // Same origin in development: the refresh cookie is first-party and no CORS is needed. `ws`
    // forwards the live connection's WebSocket too, as Vercel's rewrite does in production.
    proxy: {
      // E2E has no API: the live connection goes to the stub Socket.io server Cypress starts.
      ...(mode === "e2e" && { [E2E_SOCKET_PATH]: { target: `http://localhost:${E2E_SOCKET_PORT}`, ws: true } }),
      "/api": { target: "http://localhost:3000", ws: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
}));
