import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./test/globalSetup.ts"],
    // Endpoint tests share one Postgres test database, so files run one at a time.
    fileParallelism: false,
  },
});
