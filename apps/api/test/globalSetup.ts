import { execSync } from "node:child_process";

/** Applies migrations to the test database once before the suite. */
export default function setup() {
  try {
    process.loadEnvFile();
  } catch {
    // CI provides real environment variables.
  }
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("Set TEST_DATABASE_URL (see apps/api/.env.example) and run `pnpm db:up`.");
  execSync("pnpm exec prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
