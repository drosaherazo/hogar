import {
  checkAdminInvariant,
  type CurrentHousehold,
  type HouseholdView,
  type MembershipChange,
  type Role,
} from "@hogar/shared";
import type { Database } from "../db";
import { Prisma, type Membership } from "../generated/prisma/client";
import { badRequest, conflict, forbidden, notFound } from "../httpError";
import { HOUSEHOLD_VIEW_INCLUDE, toHouseholdView } from "./householdView";

/**
 * Serializes membership changes within one household: the transaction holds a row lock on the
 * household until it commits. Without it, two admins demoting each other at the same moment
 * could each see "someone else is still admin" and leave the household with none.
 */
export async function lockHousehold(tx: Prisma.TransactionClient, householdId: string) {
  await tx.$queryRaw`SELECT id FROM households WHERE id = ${householdId} FOR UPDATE`;
}

/**
 * Re-reads the members under the lock and refuses changes that would leave no admin.
 * With `adminActorId`, it also re-checks that the person acting is still an admin: the request's
 * role check ran before the lock, and another admin may have demoted them in the meantime.
 */
async function guardAdmins(
  tx: Prisma.TransactionClient,
  householdId: string,
  change: MembershipChange,
  adminActorId?: string,
) {
  await lockHousehold(tx, householdId);
  const members = await tx.membership.findMany({ where: { householdId }, select: { id: true, role: true } });
  if (adminActorId && members.find((member) => member.id === adminActorId)?.role !== "ADMIN") {
    throw forbidden("household.forbidden");
  }
  if (!members.some((member) => member.id === change.membershipId)) throw notFound("household.member_not_found");
  const result = checkAdminInvariant(members, change);
  if (result === "last_admin") throw conflict("household.last_admin");
  return result;
}

export interface HouseholdServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
}

/** True when Postgres rejected a row because it would break a unique constraint. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createHouseholdService({ db, now = () => new Date() }: HouseholdServiceDeps) {
  async function view(householdId: string, viewerUserId: string): Promise<HouseholdView> {
    const household = await db.household.findUniqueOrThrow({
      where: { id: householdId },
      include: HOUSEHOLD_VIEW_INCLUDE,
    });
    return toHouseholdView(household, viewerUserId);
  }

  return {
    view,

    async getCurrent(userId: string): Promise<CurrentHousehold> {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { removedFromHousehold: true, membership: { select: { householdId: true } } },
      });
      if (!user.membership) return { household: null, removedFrom: user.removedFromHousehold };
      return { household: await view(user.membership.householdId, userId) };
    },

    /** Creates the household and its first membership (ADMIN, weight 1) together, or neither. */
    async create(userId: string, name: string): Promise<HouseholdView> {
      try {
        const household = await db.household.create({
          data: {
            name,
            membersChangedAt: now(),
            memberships: { create: { userId, role: "ADMIN", weight: 1, joinedAt: now() } },
          },
        });
        return await view(household.id, userId);
      } catch (error) {
        // Membership.userId is unique: one household per user, even under concurrent requests.
        if (isUniqueViolation(error)) throw conflict("household.already_member");
        throw error;
      }
    },

    async rename(householdId: string, viewerUserId: string, name: string): Promise<HouseholdView> {
      await db.household.update({ where: { id: householdId }, data: { name } });
      return view(householdId, viewerUserId);
    },

    /** Any role change, as long as an admin remains. Weights never change with roles. */
    async changeRole(actor: Membership, membershipId: string, role: Role): Promise<HouseholdView> {
      await db.$transaction(async (tx) => {
        await guardAdmins(tx, actor.householdId, { type: "role", membershipId, role }, actor.id);
        await tx.membership.update({ where: { id: membershipId }, data: { role } });
      });
      return view(actor.householdId, actor.userId);
    },

    /** An admin removes someone else; that person sees a one-time note on their next visit. */
    async removeMember(actor: Membership, membershipId: string): Promise<HouseholdView> {
      // Removing yourself is leaving, which has its own rules (and leaves no note).
      if (membershipId === actor.id) throw badRequest();
      await db.$transaction(async (tx) => {
        await guardAdmins(tx, actor.householdId, { type: "remove", membershipId }, actor.id);
        const removed = await tx.membership.delete({
          where: { id: membershipId },
          include: { household: { select: { name: true } } },
        });
        await tx.user.update({
          where: { id: removed.userId },
          data: { removedFromHousehold: removed.household.name },
        });
        await tx.household.update({ where: { id: actor.householdId }, data: { membersChangedAt: now() } });
      });
      return view(actor.householdId, actor.userId);
    },

    /** Anyone can leave unless they're the last admin; the last member takes the household with them. */
    async leave(membership: Membership): Promise<void> {
      await db.$transaction(async (tx) => {
        const result = await guardAdmins(tx, membership.householdId, { type: "leave", membershipId: membership.id });
        if (result === "deletes_household") {
          await tx.household.delete({ where: { id: membership.householdId } });
          return;
        }
        await tx.membership.delete({ where: { id: membership.id } });
        await tx.household.update({ where: { id: membership.householdId }, data: { membersChangedAt: now() } });
      });
    },

    /**
     * Saves every member's weight at once. The list must match the current members exactly,
     * so an admin never saves a split based on an outdated member list.
     */
    async updateSplit(actor: Membership, weights: { membershipId: string; weight: number }[]): Promise<HouseholdView> {
      await db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await tx.membership.findMany({
          where: { householdId: actor.householdId },
          select: { id: true, role: true },
        });
        if (members.find((member) => member.id === actor.id)?.role !== "ADMIN") throw forbidden("household.forbidden");

        const current = new Set(members.map((member) => member.id));
        const sent = new Set(weights.map((entry) => entry.membershipId));
        if (current.size !== sent.size || [...sent].some((id) => !current.has(id))) {
          throw conflict("split.members_changed");
        }

        for (const { membershipId, weight } of weights) {
          await tx.membership.update({ where: { id: membershipId }, data: { weight } });
        }
        await tx.household.update({ where: { id: actor.householdId }, data: { splitSavedAt: now() } });
      });
      return view(actor.householdId, actor.userId);
    },

    async dismissRemovalNotice(userId: string): Promise<void> {
      await db.user.update({ where: { id: userId }, data: { removedFromHousehold: null } });
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
