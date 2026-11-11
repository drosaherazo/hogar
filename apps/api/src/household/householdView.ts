import { weightsToBasisPoints, type HouseholdView } from "@hogar/shared";
import type { Prisma } from "../generated/prisma/client";

/** Member order everywhere: who joined first. It also decides who gets leftover cents. */
export const MEMBER_ORDER = [{ joinedAt: "asc" }, { id: "asc" }] satisfies Prisma.MembershipOrderByWithRelationInput[];

/** What `toHouseholdView` needs; load it with `HOUSEHOLD_VIEW_INCLUDE`. */
export const HOUSEHOLD_VIEW_INCLUDE = {
  memberships: { orderBy: MEMBER_ORDER, include: { user: { select: { name: true, avatarUrl: true } } } },
} satisfies Prisma.HouseholdInclude;

export type HouseholdWithMembers = Prisma.HouseholdGetPayload<{ include: typeof HOUSEHOLD_VIEW_INCLUDE }>;

/** Builds what the web sees of a household, from the point of view of one of its members. */
export function toHouseholdView(household: HouseholdWithMembers, viewerUserId: string): HouseholdView {
  const members = household.memberships;
  const viewer = members.find((member) => member.userId === viewerUserId);
  if (!viewer) throw new Error("The viewer must be a member of the household");

  const weights = members.map((member) => member.weight);
  const allZero = weights.every((weight) => weight === 0);
  const shares = allZero ? weights.map(() => 0) : weightsToBasisPoints(weights);

  const splitOutdated = household.splitSavedAt === null || household.splitSavedAt < household.membersChangedAt;

  return {
    id: household.id,
    name: household.name,
    myMembershipId: viewer.id,
    myRole: viewer.role,
    members: members.map((member, index) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
      weight: member.weight,
      shareBps: shares[index] ?? 0,
      joinedAt: member.joinedAt.toISOString(),
    })),
    // A household of one has nothing to split, so it never asks for a review.
    splitNeedsReview: members.length >= 2 && (splitOutdated || allZero),
  };
}
