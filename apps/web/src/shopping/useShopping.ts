import type { AddShoppingItemInput, PersonRef, ShoppingItemView, UpdateShoppingItemInput } from "@hogar/shared";
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

/** The list's own order: when each item was added, like on paper. */
function inListOrder(items: ShoppingItemView[]): ShoppingItemView[] {
  return [...items].sort((a, b) => a.addedAt.localeCompare(b.addedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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

/**
 * Renames an item or changes its note from the version the person saw. The list shows the saved
 * item at once and is refetched either way, so a refused edit shows what is there now.
 */
export function useEditShoppingItem() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShoppingItemInput }) => client.editShoppingItem(id, input),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && items.map((other) => (other.id === item.id ? item : other)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}

/**
 * Deletes at once: the item leaves the list before the server answers, and comes back if the
 * server refuses or never hears of it (ADR 0009).
 */
export function useDeleteShoppingItem() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: ShoppingItemView) => client.deleteShoppingItem(item.id, item.version),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list });
      const before = queryClient.getQueryData<ShoppingItemView[]>(shoppingKeys.list);
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && items.filter((other) => other.id !== item.id),
      );
      return { before };
    },
    onError: (_error, _item, context) => {
      if (context?.before) queryClient.setQueryData(shoppingKeys.list, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}

/** Undoes the person's own delete: the item comes back in its place. */
export function useRestoreShoppingItem() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.restoreShoppingItem(id),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && inListOrder([...items.filter((other) => other.id !== item.id), item]),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}

/** Moving an item into the viewer's cart (`owner` is the viewer), or out of it (`owner` is null). */
export interface CartMove {
  item: ShoppingItemView;
  owner: PersonRef | null;
}

/**
 * Moves an item in or out of the person's cart at once, before the server answers, the way a tap in
 * a shop should feel. It moves back if the server refuses (someone else got there first) or never
 * hears of it, and the list is re-read either way, so it then shows whose cart the item is in
 * (ADR 0009).
 */
export function useMoveInCart() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, owner }: CartMove) => (owner ? client.putInCart(item.id) : client.takeOutOfCart(item.id)),
    onMutate: async ({ item, owner }) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list });
      const before = queryClient.getQueryData<ShoppingItemView[]>(shoppingKeys.list);
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && items.map((other) => (other.id === item.id ? { ...other, cartOwner: owner } : other)),
      );
      return { before };
    },
    onError: (_error, _move, context) => {
      if (context?.before) queryClient.setQueryData(shoppingKeys.list, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}
