-- CreateEnum
CREATE TYPE "SplitMethod" AS ENUM ('WEIGHTS', 'EQUAL', 'EXACT');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "paid_by_id" TEXT NOT NULL,
    "split_method" "SplitMethod" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_by_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_shares" (
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "expense_shares_pkey" PRIMARY KEY ("expense_id","user_id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_by_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_household_id_date_created_at_id_idx" ON "expenses"("household_id", "date" DESC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "expenses_household_id_paid_by_id_idx" ON "expenses"("household_id", "paid_by_id");

-- CreateIndex
CREATE INDEX "expense_shares_user_id_idx" ON "expense_shares"("user_id");

-- CreateIndex
CREATE INDEX "settlements_household_id_date_created_at_id_idx" ON "settlements"("household_id", "date" DESC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "settlements_household_id_from_user_id_idx" ON "settlements"("household_id", "from_user_id");

-- CreateIndex
CREATE INDEX "settlements_household_id_to_user_id_idx" ON "settlements"("household_id", "to_user_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Money is whole cents from €0.01 to €100,000.00; keep it in range even for direct writes.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 10000000);
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_amount_nonnegative" CHECK ("amount_cents" >= 0);
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 10000000);
-- A payment always goes from one person to a different one.
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_different_people" CHECK ("from_user_id" <> "to_user_id");
