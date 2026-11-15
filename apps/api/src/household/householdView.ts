import { currencyCodeSchema, weightsToBasisPoints, type HouseholdView } from "@hogar/shared";
import type { Prisma } from "../generated/prisma/client";

/** Member order everywhere: who joined first. It also decides who gets leftover cents. */
export const MEMBER_ORDER = [{ joinedAt: "asc" }, { id: "asc" }] satisfies Prisma.MembershipOrderByWithRelationInput[];

/** The records that fix a household's currency, for `isCurrencyLocked`. */
export const CURRENCY_LOCK_COUNTS = {
  expenses: true,
  settlements: true,
} satisfies Prisma.HouseholdCountOutputTypeSelect;

/** What `toHouseholdView` needs; load it with `HOUSEHOLD_VIEW_INCLUDE`. */
export const HOUSEHOLD_VIEW_INCLUDE = {
  memberships: { orderBy: MEMBER_ORDER, include: { user: { select: { name: true, avatarUrl: true } } } },
  _count: { select: CURRENCY_LOCK_COUNTS },
} satisfies Prisma.HouseholdInclude;

export type HouseholdWithMembers = Prisma.HouseholdGetPayload<{ include: typeof HOUSEHOLD_VIEW_INCLUDE }>;

/**
 * Whether a household's currency is fixed (ADR 0011): it has recorded an expense or payment.
 * Deleted records are soft-deleted rows, so they count too.
 */
export function isCurrencyLocked(counts: { expenses: number; settlements: number }): boolean {
  return counts.expenses + counts.settlements > 0;
}

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
    // Only listed codes are ever written, so a failure here is a bug worth surfacing loudly.
    currency: currencyCodeSchema.parse(household.currency),
    currencyLocked: isCurrencyLocked(household._count),
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
