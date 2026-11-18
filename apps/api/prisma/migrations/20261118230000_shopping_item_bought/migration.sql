-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "bought_at" TIMESTAMP(3),
ADD COLUMN     "bought_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_bought_by_id_fkey" FOREIGN KEY ("bought_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "shopping_items_household_name_key";

-- CreateIndex
-- The list never holds two items with the same name at once, ignoring case, accents and spaces
-- (ADR 0009). Bought and deleted items are off the list, so the same name can be added again after
-- either; undoing then meets this index. Partial, so Prisma can't model it: it lives only here.
CREATE UNIQUE INDEX "shopping_items_household_name_key" ON "shopping_items"("household_id", "name_key") WHERE "bought_at" IS NULL AND "deleted_at" IS NULL;
