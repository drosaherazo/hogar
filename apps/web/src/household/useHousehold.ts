import type {
  CreateHouseholdRequest,
  CurrencyCode,
  CurrentHousehold,
  HouseholdView,
  InvitableRole,
  Role,
  UpdateSplitRequest,
} from "@hogar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientContext";
import { ApiRequestError } from "../api/client";
import { expenseKeys } from "../expenses/useExpenses";

export const householdKeys = {
  /** The start of every query about the household, so the live connection can mark them all stale. */
  all: ["household"] as const,
  current: ["household"] as const,
  invitations: ["household", "invitations"] as const,
};

/** The signed-in person's household, kept current by the live connection (`LiveHousehold`). */
export function useHousehold() {
  const client = useApiClient();
  return useQuery({
    queryKey: householdKeys.current,
    queryFn: () => client.getHousehold(),
  });
}

/** Mutations that answer with the updated household write it straight into the cache. */
function useHouseholdMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<HouseholdView>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (household) => {
      queryClient.setQueryData<CurrentHousehold>(householdKeys.current, { household });
    },
  });
}

export function useCreateHousehold() {
  const client = useApiClient();
  return useHouseholdMutation((request: CreateHouseholdRequest) => client.createHousehold(request));
}

export function useRenameHousehold() {
  const client = useApiClient();
  return useHouseholdMutation((name: string) => client.renameHousehold(name));
}

/**
 * What money forms do when a save is refused with `money.currency.mismatch` (ADR 0011): the
 * household's currency changed while the form was open, so reload it. The amount field then reads
 * and labels the typed amount in the new currency, for the person to check and save again.
 */
export function useReloadOnCurrencyMismatch() {
  const queryClient = useQueryClient();
  return (error: Error) => {
    if (error instanceof ApiRequestError && error.code === "money.currency.mismatch") {
      void queryClient.invalidateQueries({ queryKey: householdKeys.current });
    }
  };
}

export function useChangeCurrency() {
  const client = useApiClient();
  return useHouseholdMutation((currency: CurrencyCode) => client.changeCurrency(currency));
}

export function useChangeRole() {
  const client = useApiClient();
  return useHouseholdMutation(({ membershipId, role }: { membershipId: string; role: Role }) =>
    client.changeRole(membershipId, role),
  );
}

export function useRemoveMember() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useHouseholdMutation(async (membershipId: string) => {
    const household = await client.removeMember(membershipId);
    // The removed person may still owe or be owed: their balance now shows as a former member's.
    void queryClient.invalidateQueries({ queryKey: expenseKeys.balances });
    return household;
  });
}

export function useUpdateSplit() {
  const client = useApiClient();
  return useHouseholdMutation((weights: UpdateSplitRequest["weights"]) => client.updateSplit(weights));
}

export function useAcceptInvitation() {
  const client = useApiClient();
  return useHouseholdMutation((token: string) => client.acceptInvitation(token));
}

export function useLeaveHousehold() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.leaveHousehold(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: householdKeys.invitations });
      // That household's money isn't theirs to see any more.
      queryClient.removeQueries({ queryKey: expenseKeys.activity });
      queryClient.removeQueries({ queryKey: expenseKeys.balances });
      const noHousehold: CurrentHousehold = { household: null, removedFrom: null };
      queryClient.setQueryData(householdKeys.current, noHousehold);
    },
  });
}

/**
 * Tells the server the removal note was seen. The cache is left alone on purpose: the note
 * stays on screen for this visit and is simply gone on the next one.
 */
export function useDismissRemovalNotice() {
  const client = useApiClient();
  return useMutation({ mutationFn: () => client.dismissRemovalNotice() });
}

// --- Invitations (admins) ----------------------------------------------------

export function useInvitations(enabled: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: householdKeys.invitations,
    queryFn: () => client.listInvitations(),
    enabled,
  });
}

function useInvitationMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdKeys.invitations }),
  });
}

export function useCreateInvitation() {
  const client = useApiClient();
  return useInvitationMutation((role: InvitableRole) => client.createInvitation(role));
}

export function useRenewInvitation() {
  const client = useApiClient();
  return useInvitationMutation((id: string) => client.renewInvitation(id));
}

export function useRevokeInvitation() {
  const client = useApiClient();
  return useInvitationMutation((id: string) => client.revokeInvitation(id));
}
