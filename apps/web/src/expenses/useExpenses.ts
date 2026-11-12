import type { ExpenseInput, SettlementInput, UpdateExpenseInput, UpdateSettlementInput } from "@hogar/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientContext";
import { ApiRequestError } from "../api/client";

export const expenseKeys = {
  activity: ["household", "activity"] as const,
  balances: ["household", "balances"] as const,
  expense: (id: string) => ["household", "expense", id] as const,
  settlement: (id: string) => ["household", "settlement", id] as const,
};

/** Something that isn't there won't appear by asking again; anything else gets one retry. */
const retryUnlessMissing = (failureCount: number, error: unknown) =>
  !(error instanceof ApiRequestError && error.status === 404) && failureCount < 1;

/**
 * The household's history, page by page, optionally only one category (an id, or `none`). Each
 * filter is cached on its own. Refetched when people come back to the tab, so other people's
 * expenses show up without real time (that's a later feature).
 */
export function useActivity(category?: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: [...expenseKeys.activity, category ?? "all"],
    queryFn: ({ pageParam }) => client.getActivity(pageParam, category),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchOnWindowFocus: true,
  });
}

/** Everyone's balance, refetched when people come back to the tab. */
export function useBalances() {
  const client = useApiClient();
  return useQuery({
    queryKey: expenseKeys.balances,
    queryFn: () => client.getBalances(),
    refetchOnWindowFocus: true,
  });
}

export function useExpense(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: expenseKeys.expense(id),
    queryFn: () => client.getExpense(id),
    refetchOnWindowFocus: true,
    retry: retryUnlessMissing,
  });
}

export function useSettlement(id: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: expenseKeys.settlement(id ?? ""),
    queryFn: () => client.getSettlement(id ?? ""),
    enabled: id !== null,
    retry: retryUnlessMissing,
  });
}

/** Records a payment; the history and balances are refetched. */
export function useCreateSettlement() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettlementInput) => client.createSettlement(input),
    onSuccess: (settlement) => {
      queryClient.setQueryData(expenseKeys.settlement(settlement.id), settlement);
      void queryClient.invalidateQueries({ queryKey: expenseKeys.activity });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.balances });
    },
  });
}

/** Records an expense; the history and balances are refetched, and its details are ready to show. */
export function useCreateExpense() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseInput) => client.createExpense(input),
    onSuccess: (expense) => {
      queryClient.setQueryData(expenseKeys.expense(expense.id), expense);
      void queryClient.invalidateQueries({ queryKey: expenseKeys.activity });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.balances });
    },
  });
}

/** After any change to the money history, the history and balances are refetched. */
function useRefreshMoney() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: expenseKeys.activity });
    void queryClient.invalidateQueries({ queryKey: expenseKeys.balances });
  };
}

export function useUpdateExpense() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshMoney();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => client.updateExpense(id, input),
    onSuccess: (expense) => {
      queryClient.setQueryData(expenseKeys.expense(expense.id), expense);
      refresh();
    },
  });
}

export function useDeleteExpense() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshMoney();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => client.deleteExpense(id, version),
    onSuccess: (_, { id }) => {
      queryClient.removeQueries({ queryKey: expenseKeys.expense(id) });
      refresh();
    },
  });
}

export function useUpdateSettlement() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshMoney();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSettlementInput }) => client.updateSettlement(id, input),
    onSuccess: (settlement) => {
      queryClient.setQueryData(expenseKeys.settlement(settlement.id), settlement);
      refresh();
    },
  });
}

export function useDeleteSettlement() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshMoney();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => client.deleteSettlement(id, version),
    onSuccess: (_, { id }) => {
      queryClient.removeQueries({ queryKey: expenseKeys.settlement(id) });
      refresh();
    },
  });
}
