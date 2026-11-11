import type { Role } from "./household";

export type MembershipChange =
  { type: "leave" | "remove"; membershipId: string } | { type: "role"; membershipId: string; role: Role };

/**
 * - `ok`: the change keeps at least one admin.
 * - `deletes_household`: the only member is leaving, so the household goes away with them.
 * - `last_admin`: the change would leave members without an admin; refuse it.
 */
export type AdminInvariantResult = "ok" | "deletes_household" | "last_admin";

/**
 * A household with members always keeps at least one ADMIN. The API runs this inside the
 * transaction that applies the change; the web uses it only to explain disabled buttons.
 */
export function checkAdminInvariant(
  members: readonly { id: string; role: Role }[],
  change: MembershipChange,
): AdminInvariantResult {
  const remaining =
    change.type === "role"
      ? members.map((member) => (member.id === change.membershipId ? { ...member, role: change.role } : member))
      : members.filter((member) => member.id !== change.membershipId);

  if (remaining.length === 0) return "deletes_household";
  return remaining.some((member) => member.role === "ADMIN") ? "ok" : "last_admin";
}

/** Renaming, inviting, managing members and editing the split are admin-only. */
export function canManageHousehold(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Creating and editing content (expenses, payments, and later chores and the shopping list) is
 * open to admins and members; guests only read.
 */
export function canEditContent(role: Role): boolean {
  return role === "ADMIN" || role === "MEMBER";
}
