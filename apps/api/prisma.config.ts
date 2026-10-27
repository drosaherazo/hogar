import { defineConfig } from "prisma/config";

// Prisma's CLI doesn't read .env on its own; load it when present (CI sets real env vars).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` (run on install) needs no database; migrate commands fail clearly if it's missing.
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
