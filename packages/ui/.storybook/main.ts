import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const figtreeFiles = join(dirname(require.resolve("@fontsource-variable/figtree/package.json")), "files");

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
  staticDirs: [
    { from: "./assets", to: "/brand" },
    { from: figtreeFiles, to: "/fonts" },
  ],
  // Self-hosted Figtree and the Hogar favicon for Storybook's own interface.
  managerHead: (head = "") => `${head}
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
    <style>
      @font-face {
        font-family: "Figtree Variable";
        font-style: normal;
        font-display: swap;
        font-weight: 300 900;
        src: url("/fonts/figtree-latin-wght-normal.woff2") format("woff2-variations");
        unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
      }
      @font-face {
        font-family: "Figtree Variable";
        font-style: normal;
        font-display: swap;
        font-weight: 300 900;
        src: url("/fonts/figtree-latin-ext-wght-normal.woff2") format("woff2-variations");
        unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
      }
    </style>`,
  previewHead: (head = "") => `${head}
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />`,
};

export default config;
