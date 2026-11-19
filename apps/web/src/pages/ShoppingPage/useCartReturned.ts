import { canEditContent, type ShoppingItemView } from "@hogar/shared";
import { useState } from "react";
import { useCurrentUser } from "../../auth/guards";
import { useHousehold } from "../../household/useHousehold";
import { cartOf } from "../../shopping/useShopping";

interface Seen {
  /** Whether the viewer could shop (an admin or member) last time. */
  editor: boolean;
  /** How many items were in their cart while they could. */
  cart: number;
  /** Whether their cart went back to the list when they became a guest. */
  returned: boolean;
}

/**
 * Whether the viewer's cart went back to the list because they became a guest while on this page,
 * so the page can say why their items left it. The server empties the cart in the same change as
 * the role and keeps no record of it, so the page works it out from what it saw: the viewer was an
 * admin or member with items in their cart, and is now a guest.
 *
 * The household and the list are re-read separately, so they arrive in either order. When the
 * list comes first, the cart looks empty while the role still reads as before; the household is
 * then still being re-read, so the cart is remembered until the role arrives. A cart that empties
 * while nothing is being re-read was emptied by the person (taking things out, or finishing).
 */
export function useCartReturned(items: readonly ShoppingItemView[]): boolean {
  const household = useHousehold();
  const user = useCurrentUser();
  const role = household.data?.household?.myRole;
  const editor = role !== undefined && canEditContent(role);
  const inMyCart = cartOf(items, user.id).length;
  const [seen, setSeen] = useState<Seen>({ editor, cart: inMyCart, returned: false });

  // Compared with what the last render saw, as React suggests for state that follows other state.
  let next = seen;
  if (editor) {
    const cart = inMyCart > 0 || !household.isFetching ? inMyCart : seen.cart;
    if (!seen.editor || cart !== seen.cart || seen.returned) next = { editor, cart, returned: false };
  } else if (seen.editor) {
    next = { editor, cart: 0, returned: seen.cart > 0 };
  }
  if (next !== seen) setSeen(next);
  return next.returned;
}
