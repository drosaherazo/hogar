import { readdirSync, readFileSync } from "node:fs";
import { STARTER_CATEGORIES } from "@hogar/shared";
import { describe, expect, it } from "vitest";

/**
 * The migration that gave existing households their starter set repeats the shared constants
 * in SQL. This keeps both in sync: same order, emoji and names in both languages.
 */
describe("starter categories in the migration", () => {
  it("match STARTER_CATEGORIES exactly and in order", () => {
    const migrations = new URL("../prisma/migrations/", import.meta.url);
    const folder = readdirSync(migrations).find((name) => name.endsWith("_expense_categories"));
    expect(folder).toBeDefined();
    const sql = readFileSync(new URL(`${folder}/migration.sql`, migrations), "utf8");

    const rows = [...sql.matchAll(/\((\d+), '([^']+)', '([^']+)', '([^']+)'\)/gu)].map((match) => ({
      position: Number(match[1]),
      emoji: match[2],
      name: { en: match[3], es: match[4] },
    }));
    expect(rows).toEqual(
      STARTER_CATEGORIES.map((category, index) => ({
        position: index + 1,
        emoji: category.emoji,
        name: { en: category.name.en, es: category.name.es },
      })),
    );
  });
});
