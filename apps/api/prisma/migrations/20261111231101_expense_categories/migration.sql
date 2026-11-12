-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "position" INTEGER NOT NULL,
    "own_split" BOOLEAN NOT NULL DEFAULT false,
    "split_saved_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_weights" (
    "category_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "category_weights_pkey" PRIMARY KEY ("category_id","membership_id")
);

-- CreateIndex
CREATE INDEX "expense_categories_household_id_position_idx" ON "expense_categories"("household_id", "position");

-- CreateIndex
CREATE INDEX "category_weights_membership_id_idx" ON "category_weights"("membership_id");

-- CreateIndex
CREATE INDEX "expenses_household_id_category_id_idx" ON "expenses"("household_id", "category_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_weights" ADD CONSTRAINT "category_weights_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_weights" ADD CONSTRAINT "category_weights_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A member's weight in a category's own split is 0–100, like their household weight.
ALTER TABLE "category_weights"
  ADD CONSTRAINT "category_weights_weight_range" CHECK ("weight" BETWEEN 0 AND 100);

-- Category names are unique per household ignoring case (the service also checks, under the
-- household lock, to answer with a friendly error code).
CREATE UNIQUE INDEX "expense_categories_household_name_key"
  ON "expense_categories" ("household_id", lower("name"));

-- Starter set for households that already exist (FR-002), in the locale of the
-- longest-standing admin. Runs once, with the deploy. Keep in sync with STARTER_CATEGORIES
-- in packages/shared/src/categories.ts (apps/api/test/starterCategories.test.ts checks it).
INSERT INTO "expense_categories" ("id", "household_id", "name", "emoji", "position", "own_split", "version", "created_at")
SELECT gen_random_uuid()::text, h."id",
       CASE WHEN admin_locale.locale = 'es' THEN s.name_es ELSE s.name_en END,
       s.emoji, s.position, false, 1, now()
FROM "households" h
CROSS JOIN (VALUES
  (1, '🏠', 'Rent', 'Alquiler'),
  (2, '🛒', 'Groceries', 'Comida'),
  (3, '💡', 'Utilities', 'Suministros'),
  (4, '🎉', 'Leisure', 'Ocio'),
  (5, '📦', 'Other', 'Otros')
) AS s(position, emoji, name_en, name_es)
LEFT JOIN LATERAL (
  SELECT u."locale" FROM "memberships" m JOIN "users" u ON u."id" = m."user_id"
  WHERE m."household_id" = h."id" AND m."role" = 'ADMIN'
  ORDER BY m."joined_at", m."id" LIMIT 1
) AS admin_locale ON true;
