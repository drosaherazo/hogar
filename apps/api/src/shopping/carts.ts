import type { Prisma } from "../generated/prisma/client";

/**
 * Puts everything in `userId`'s cart back on the list, still to buy, when they can no longer have
 * a cart: they left, were removed or became a guest. Call it in the same transaction as that
 * membership change, so no cart is left that nobody can empty. Deleted items count too, so undoing
 * a delete never puts an item back into a cart that is gone. It isn't an edit: the version stays.
 * Returns how many items it put back.
 */
export async function emptyCart(tx: Prisma.TransactionClient, householdId: string, userId: string): Promise<number> {
  const { count } = await tx.shoppingItem.updateMany({
    where: { householdId, cartOwnerId: userId },
    data: { cartOwnerId: null },
  });
  return count;
}
