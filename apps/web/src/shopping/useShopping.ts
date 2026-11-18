import {
  SHOPPING_ITEM_NAME_MAX,
  shoppingNameKey,
  type AddShoppingItemInput,
  type ExpenseInput,
  type PersonRef,
  type ShoppingItemView,
  type ShoppingList,
  type ShoppingSuggestion,
  type UpdateShoppingItemInput,
} from "@hogar/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApiClient } from "../api/ApiClientContext";
import { expenseKeys } from "../expenses/useExpenses";

/** Under the household's key, so the installed app keeps the list with the rest (ADR 0015). */
export const shoppingKeys = {
  list: ["household", "shopping"] as const,
  /**
   * Under the list's key, so whatever re-reads the list (a change, a live event, catching up)
   * re-reads the suggestions too: what goes on the list leaves them.
   */
  suggestions: (nameKey: string) => [...shoppingKeys.list, "suggestions", nameKey] as const,
};

const itemsOf = (list: ShoppingList) => list.items;
const lastCategoryOf = (list: ShoppingList) => list.lastCategoryId;

/**
 * The household's shopping list, in the order items were added, kept current by the live
 * connection (`LiveHousehold` re-reads it on `shopping:changed`).
 */
export function useShoppingList() {
  const client = useApiClient();
  return useQuery({
    queryKey: shoppingKeys.list,
    queryFn: () => client.getShoppingList(),
    select: itemsOf,
  });
}

/** The category of the household's last purchase expense, which the next one starts with. */
export function useLastPurchaseCategory() {
  const client = useApiClient();
  return useQuery({
    queryKey: shoppingKeys.list,
    queryFn: () => client.getShoppingList(),
    select: lastCategoryOf,
  });
}

/** Changes the items the list shows, before the server answers or with what it answered. */
function updateItems(queryClient: QueryClient, update: (items: ShoppingItemView[]) => ShoppingItemView[]) {
  queryClient.setQueryData<ShoppingList>(shoppingKeys.list, (list) => list && { ...list, items: update(list.items) });
}

/**
 * A change the list shows at once, before the server answers, the way a tap in a shop should feel:
 * `change` applied to the items. The list as it was comes back if the server refuses or never
 * hears of it, and it is re-read either way, so it then shows what is there now (ADR 0009).
 */
function useChangeListAtOnce<TVariables, TData>(
  send: (variables: TVariables) => Promise<TData>,
  change: (items: ShoppingItemView[], variables: TVariables) => ShoppingItemView[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list });
      const before = queryClient.getQueryData<ShoppingList>(shoppingKeys.list);
      updateItems(queryClient, (items) => change(items, variables));
      return { before };
    },
    onError: (_error, _variables, context) => {
      if (context?.before) queryClient.setQueryData(shoppingKeys.list, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
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
      updateItems(queryClient, (items) => [...items, item]);
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
      updateItems(queryClient, (items) => items.map((other) => (other.id === item.id ? item : other)));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}

/** Deletes at once: the item leaves the list before the server answers. */
export function useDeleteShoppingItem() {
  const client = useApiClient();
  return useChangeListAtOnce(
    (item: ShoppingItemView) => client.deleteShoppingItem(item.id, item.version),
    (items, item) => items.filter((other) => other.id !== item.id),
  );
}

/** Undoes the person's own delete: the item comes back in its place. */
export function useRestoreShoppingItem() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.restoreShoppingItem(id),
    onSuccess: (item) => {
      updateItems(queryClient, (items) => inListOrder([...items.filter((other) => other.id !== item.id), item]));
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
 * Moves an item in or out of the person's cart at once. When someone else got there first, it
 * moves back and the re-read list shows whose cart the item is in.
 */
export function useMoveInCart() {
  const client = useApiClient();
  return useChangeListAtOnce(
    ({ item, owner }: CartMove) => (owner ? client.putInCart(item.id) : client.takeOutOfCart(item.id)),
    (items, { item, owner }) => items.map((other) => (other.id === item.id ? { ...other, cartOwner: owner } : other)),
  );
}

/** The items in `userId`'s cart, in list order. */
export function cartOf(items: readonly ShoppingItemView[], userId: string): ShoppingItemView[] {
  return items.filter((item) => item.cartOwner?.userId === userId);
}

/**
 * Finishes shopping without an expense: the items leave the list at once, and come back if the
 * cart changed meanwhile.
 */
export function useFinishShopping() {
  const client = useApiClient();
  return useChangeListAtOnce(
    (itemIds: readonly string[]) => client.finishShopping(itemIds),
    (items, itemIds) => items.filter((item) => !itemIds.includes(item.id)),
  );
}

/** Finishing shopping noting what the person paid: everything in their cart, and the expense. */
export interface FinishWithExpense {
  itemIds: readonly string[];
  expense: ExpenseInput;
}

/**
 * Finishes shopping noting what the person paid. Unlike finishing without an expense it waits for
 * the server, which may refuse the expense, and the form shows the answer. The expense's details
 * are then ready to show, and the list, the history and the balances are read again.
 */
export function useFinishShoppingWithExpense() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemIds, expense }: FinishWithExpense) => client.finishShoppingWithExpense(itemIds, expense),
    onSuccess: (expense) => {
      queryClient.setQueryData(expenseKeys.expense(expense.id), expense);
      void queryClient.invalidateQueries({ queryKey: expenseKeys.activity });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.balances });
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
      updateItems(queryClient, (items) => inListOrder([...items.filter((item) => !ids.has(item.id)), ...back]));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKeys.list }),
  });
}
