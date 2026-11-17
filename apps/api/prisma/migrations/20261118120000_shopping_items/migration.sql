-- CreateTable
CREATE TABLE "shopping_items" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "note" TEXT,
    "asked_by_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "shopping_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_items_household_id_added_at_idx" ON "shopping_items"("household_id", "added_at");

-- CreateIndex
CREATE INDEX "shopping_items_asked_by_id_idx" ON "shopping_items"("asked_by_id");

-- CreateIndex
-- The list never holds two items with the same name at once, ignoring case, accents and spaces
-- (ADR 0009). Every item is on the list for now; this becomes a partial index (items not bought
-- and not deleted) when bought and deleted items arrive.
CREATE UNIQUE INDEX "shopping_items_household_name_key" ON "shopping_items"("household_id", "name_key");

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_asked_by_id_fkey" FOREIGN KEY ("asked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

