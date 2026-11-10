import type { CurrentHousehold, HouseholdView, InvitableRole, Role, UpdateSplitRequest } from "@hogar/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientContext";

export const householdKeys = {
  current: ["household"] as const,
  invitations: ["household", "invitations"] as const,
};

/**
 * The signed-in person's household. Refetched when they come back to the tab, so changes
 * made by others show up without real time (that's a later feature).
 */
export function useHousehold() {
  const client = useApiClient();
  return useQuery({
    queryKey: householdKeys.current,
    queryFn: () => client.getHousehold(),
    refetchOnWindowFocus: true,
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
  return useHouseholdMutation((name: string) => client.createHousehold(name));
}

export function useRenameHousehold() {
  const client = useApiClient();
  return useHouseholdMutation((name: string) => client.renameHousehold(name));
}

export function useChangeRole() {
  const client = useApiClient();
  return useHouseholdMutation(({ membershipId, role }: { membershipId: string; role: Role }) =>
    client.changeRole(membershipId, role),
  );
}

export function useRemoveMember() {
  const client = useApiClient();
  return useHouseholdMutation((membershipId: string) => client.removeMember(membershipId));
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
    refetchOnWindowFocus: true,
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
