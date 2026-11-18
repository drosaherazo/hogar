import {
  SHOPPING_ITEM_NAME_MAX,
  shoppingNameKey,
  type AddShoppingItemInput,
  type PersonRef,
  type ShoppingItemView,
  type ShoppingSuggestion,
  type UpdateShoppingItemInput,
} from "@hogar/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApiClient } from "../api/ApiClientContext";

/** Under the household's key, so the installed app keeps the list with the rest (ADR 0015). */
export const shoppingKeys = {
  list: ["household", "shopping"] as const,
  /**
   * Under the list's key, so whatever re-reads the list (a change, a live event, catching up)
   * re-reads the suggestions too: what goes on the list leaves them.
   */
  suggestions: (nameKey: string) => [...shoppingKeys.list, "suggestions", nameKey] as const,
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

const NO_SUGGESTIONS: ShoppingSuggestion[] = [];

/**
 * What the household bought before that matches what the person is typing, the most bought first,
 * leaving out what is on `items` (the list they see). While the server answers a new query, the
 * last answer stays, narrowed to what still matches, so the suggestions follow every keystroke
 * without flickering. Nothing is typed, nothing is suggested.
 *
 * Kept out of the installed app's offline copy: nothing can be added offline (ADR 0015), and
 * every half-typed name would otherwise be saved there.
 */
export function useShoppingSuggestions(typed: string, items: readonly ShoppingItemView[]): ShoppingSuggestion[] {
  const client = useApiClient();
  const nameKey = shoppingNameKey(typed);
  const query = useQuery({
    queryKey: shoppingKeys.suggestions(nameKey),
    queryFn: () => client.getShoppingSuggestions(typed.trim()),
    enabled: nameKey !== "" && typed.trim().length <= SHOPPING_ITEM_NAME_MAX,
    placeholderData: keepPreviousData,
    meta: { offline: false },
  });
  const { data } = query;
  return useMemo(() => {
    if (nameKey === "" || !data) return NO_SUGGESTIONS;
    const listed = new Set(items.map((item) => shoppingNameKey(item.name)));
    return data.filter((suggestion) => {
      const key = shoppingNameKey(suggestion.name);
      return key.includes(nameKey) && !listed.has(key);
    });
  }, [data, items, nameKey]);
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

/** The items in `userId`'s cart, in list order. */
export function cartOf(items: readonly ShoppingItemView[], userId: string): ShoppingItemView[] {
  return items.filter((item) => item.cartOwner?.userId === userId);
}

/**
 * Finishes shopping without an expense: the items leave the list at once, before the server
 * answers, and come back if it refuses (the cart changed meanwhile) or never hears of it.
 */
export function useFinishShopping() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: readonly string[]) => client.finishShopping(itemIds),
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list });
      const before = queryClient.getQueryData<ShoppingItemView[]>(shoppingKeys.list);
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && items.filter((item) => !itemIds.includes(item.id)),
      );
      return { before };
    },
    onError: (_error, _itemIds, context) => {
      if (context?.before) queryClient.setQueryData(shoppingKeys.list, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}

/** Undoes a finish: what it bought comes back into the person's cart, each item in its place. */
export function useUndoFinishShopping() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: readonly string[]) => client.undoFinishShopping(itemIds),
    onSuccess: (back) => {
      const ids = new Set(back.map((item) => item.id));
      queryClient.setQueryData<ShoppingItemView[]>(
        shoppingKeys.list,
        (items) => items && inListOrder([...items.filter((item) => !ids.has(item.id)), ...back]),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}
