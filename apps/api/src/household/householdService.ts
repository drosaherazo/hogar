import type { CurrentHousehold, HouseholdView } from "@hogar/shared";
import type { Database } from "../db";
import { Prisma } from "../generated/prisma/client";
import { conflict } from "../httpError";
import { HOUSEHOLD_VIEW_INCLUDE, toHouseholdView } from "./householdView";

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
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
