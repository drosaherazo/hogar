/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { pwaOptions } from "./pwa.config.ts";

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  server: {
    port: 5173,
    strictPort: true,
    // Same origin in development: the refresh cookie is first-party and no CORS is needed.
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
