-- One currency per household (ADR 0011). Households created before currencies existed were
-- in euros, so they keep EUR and see no change; new households always say which currency.
-- AlterTable
ALTER TABLE "households" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "households" ALTER COLUMN "currency" DROP DEFAULT;
-- Always an ISO 4217 code. Which codes are listed stays in packages/shared, so adding a currency
-- is one list entry and a test, never a migration.
ALTER TABLE "households" ADD CONSTRAINT "households_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$');

-- The maximum amount is now 1,000,000,000 minor units in every currency (a year of rent in
-- Colombian pesos is about 30,000,000), mirroring MAX_AMOUNT_UNITS in packages/shared.
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_amount_range";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 1000000000);
ALTER TABLE "settlements" DROP CONSTRAINT "settlements_amount_range";
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amount_range" CHECK ("amount_cents" BETWEEN 1 AND 1000000000);
