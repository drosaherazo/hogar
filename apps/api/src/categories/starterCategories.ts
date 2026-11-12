import { STARTER_CATEGORIES, type Locale } from "@hogar/shared";
import type { Prisma } from "../generated/prisma/client";

/**
 * Gives a new household the starter set (research R4), named in its creator's language. After
 * this they are ordinary categories that admins rename and delete.
 */
export async function seedStarterCategories(tx: Prisma.TransactionClient, householdId: string, locale: Locale) {
  await tx.expenseCategory.createMany({
    data: STARTER_CATEGORIES.map((category, index) => ({
      householdId,
      name: category.name[locale],
      emoji: category.emoji,
      position: index + 1,
    })),
  });
}
