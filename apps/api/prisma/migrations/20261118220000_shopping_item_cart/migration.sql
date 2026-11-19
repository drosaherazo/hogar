-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "cart_owner_id" TEXT;

-- CreateIndex
CREATE INDEX "shopping_items_household_id_cart_owner_id_idx" ON "shopping_items"("household_id", "cart_owner_id");

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_cart_owner_id_fkey" FOREIGN KEY ("cart_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
