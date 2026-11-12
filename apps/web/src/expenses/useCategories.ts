import type { CategoryView, CreateCategoryInput, UpdateCategoryInput, UpdateCategorySplitInput } from "@hogar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientContext";
import { householdKeys } from "../household/useHousehold";
import { expenseKeys } from "./useExpenses";

export const categoryKeys = {
  all: ["household", "categories"] as const,
};

/**
 * The household's categories in list order, with how each one is split. Refetched when people
 * come back to the tab, so other people's changes show up without real time.
 */
export function useCategories() {
  const client = useApiClient();
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: () => client.getCategories(),
    refetchOnWindowFocus: true,
  });
}

/**
 * After any change to a category: the list itself, the history (labels show its name) and the
 * household are refetched.
 */
function useCategoryMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.activity });
      void queryClient.invalidateQueries({ queryKey: householdKeys.current, exact: true });
    },
  });
}

export function useCreateCategory() {
  const client = useApiClient();
  return useCategoryMutation((input: CreateCategoryInput) => client.createCategory(input));
}

export function useUpdateCategory() {
  const client = useApiClient();
  return useCategoryMutation(({ id, input }: { id: string; input: UpdateCategoryInput }) =>
    client.updateCategory(id, input),
  );
}

export function useUpdateCategorySplit() {
  const client = useApiClient();
  return useCategoryMutation(({ id, input }: { id: string; input: UpdateCategorySplitInput }) =>
    client.updateCategorySplit(id, input),
  );
}

export function useDeleteCategory() {
  const client = useApiClient();
  return useCategoryMutation(({ id, version }: Pick<CategoryView, "id" | "version">) =>
    client.deleteCategory(id, version),
  );
}
