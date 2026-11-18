import type { AddShoppingItemInput, ShoppingItemView } from "@hogar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientContext";

/** Under the household's key, so the installed app keeps the list with the rest (ADR 0015). */
export const shoppingKeys = {
  list: ["household", "shopping"] as const,
};

/**
 * The household's shopping list, in the order items were added, kept current by the live
 * connection (`LiveHousehold` re-reads it on `shopping:changed`).
 */
export function useShoppingList() {
  const client = useApiClient();
  return useQuery({
    queryKey: shoppingKeys.list,
    queryFn: () => client.getShoppingList(),
  });
}

/**
 * Adds an item. The new item goes last on the list straight away; the list is refetched either
 * way, so a refused duplicate shows the item that was already there.
 */
export function useAddShoppingItem() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddShoppingItemInput) => client.addShoppingItem(input),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItemView[]>(shoppingKeys.list, (items) => items && [...items, item]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}
