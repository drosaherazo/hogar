import { defineConfig } from "cypress";
import { startSocketStub } from "./cypress/socketStub";

export default defineConfig({
  e2e: {
    // A separate Vite instance in "e2e" mode, so it never clashes with `pnpm dev`.
    baseUrl: "http://localhost:5174",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    viewportWidth: 390,
    viewportHeight: 844,
    setupNodeEvents(on) {
      on("task", startSocketStub());
    },
  },
});
