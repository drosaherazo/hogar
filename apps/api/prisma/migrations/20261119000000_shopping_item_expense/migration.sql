-- AlterTable
ALTER TABLE "shopping_items" ADD COLUMN     "expense_id" TEXT;

-- CreateIndex
CREATE INDEX "shopping_items_expense_id_idx" ON "shopping_items"("expense_id");

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
