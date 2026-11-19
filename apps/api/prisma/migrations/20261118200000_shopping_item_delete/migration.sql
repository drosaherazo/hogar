-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "shopping_items_household_name_key";

-- CreateIndex
-- The list never holds two items with the same name at once, ignoring case, accents and spaces
-- (ADR 0009). Deleted items are off the list, so the same name can be added again after a delete;
-- undoing that delete then meets this index. Partial, so Prisma can't model it: it lives only here.
CREATE UNIQUE INDEX "shopping_items_household_name_key" ON "shopping_items"("household_id", "name_key") WHERE "deleted_at" IS NULL;
