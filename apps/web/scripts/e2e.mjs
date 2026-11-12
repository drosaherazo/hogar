// Runs Cypress against its own Vite (see dev:e2e): `node scripts/e2e.mjs run|open`.
// Some terminals (VS Code's, Claude Code's) export ELECTRON_RUN_AS_NODE=1, which makes Cypress's
// Electron binary act as plain Node and fail with "bad option: --smoke-test", so drop it here.
import { spawnSync } from "node:child_process";

const mode = process.argv[2] === "open" ? "open" : "run";
delete process.env["ELECTRON_RUN_AS_NODE"];
const result = spawnSync(`start-server-and-test dev:e2e http://localhost:5174 "cypress ${mode}"`, {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
