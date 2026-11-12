// Checks that prisma/migrations is a clean history of schema.prisma, so a bad migration never
// reaches main: once Render's `migrate deploy` applies one, it's permanent history.
//   1. No migration is empty (a second `migrate dev` can leave an empty folder behind).
//   2. Replaying every migration gives exactly the schema (none forgotten, none out of sync).
// Needs SHADOW_DATABASE_URL: a scratch database Prisma replays the migrations into.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = "prisma/migrations";

const empty = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(migrationsDir, entry.name, "migration.sql"))
  .filter((file) => {
    const sql = readFileSync(file, "utf8")
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    return sql.trim() === "";
  });

if (empty.length > 0) {
  console.error(`Empty migrations (delete them, and their rows in _prisma_migrations):\n  ${empty.join("\n  ")}`);
  process.exit(1);
}

if (!process.env["SHADOW_DATABASE_URL"]) {
  console.error("SHADOW_DATABASE_URL is not set: point it at a scratch database (see apps/api/.env.example).");
  process.exit(1);
}

try {
  execSync(`prisma migrate diff --from-migrations ${migrationsDir} --to-schema prisma/schema.prisma --exit-code`, {
    stdio: "inherit",
  });
} catch (error) {
  if (error.status === 2) {
    console.error(
      "\nschema.prisma and prisma/migrations disagree (above). Run `pnpm db:migrate` to add the missing migration.",
    );
  }
  process.exit(error.status ?? 1);
}
console.log("Migrations match schema.prisma.");
