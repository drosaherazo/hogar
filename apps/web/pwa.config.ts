import type { VitePWAOptions } from "vite-plugin-pwa";

/** The light theme's background (`--color-bg`): the manifest has no per-theme colors. */
const LIGHT_BACKGROUND = "#fbf8fa";

/**
 * The installable app (spec #82): a manifest and a service worker that precaches the app's own
 * files. It never caches `/api/*`, so sessions, cookies and token rotation work exactly as ADRs
 * 0002 and 0006 describe, and it only takes over after the person accepts the update notice.
 * Off in development and E2E (`devOptions`), where Vite serves files straight from source.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "prompt",
  // The app registers it itself (src/update/appUpdate.ts) to drive the update notice.
  injectRegister: false,
  devOptions: { enabled: false },
  // The glob below already precaches the icons.
  includeManifestIcons: false,
  manifest: {
    id: "/",
    // The brand, identical in both languages.
    name: "Hogar",
    short_name: "Hogar",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // No orientation: people hold or mount their phone however suits them (WCAG 1.3.4).
    theme_color: LIGHT_BACKGROUND,
    background_color: LIGHT_BACKGROUND,
    icons: [
      { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // Everything the build outputs, public icons included, and nothing else.
    globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    // Pages open from the cached app; API addresses always go to the network, untouched.
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
  },
};
