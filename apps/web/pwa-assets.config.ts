import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

/** The Hogar mark's fuchsia, so maskable and Apple icons fill their safe zone with the brand. */
const BRAND = "#eb2386";

// Regenerate the committed icons in public/ only when the mark changes: `pnpm --filter @hogar/web icons`.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: BRAND } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: BRAND } },
  },
  images: ["public/favicon.svg"],
});
