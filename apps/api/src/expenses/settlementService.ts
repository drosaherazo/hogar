import type { SettlementInput, SettlementView, UpdateSettlementInput } from "@hogar/shared";
import type { Database } from "../db";
import type { Membership, Settlement } from "../generated/prisma/client";
import { lockHousehold } from "../household/householdService";
import { badRequest, conflict, notFound } from "../httpError";
import { assertNotFuture, fromCalendarDate, toCalendarDate } from "./dates";
import {
  assertStillEditor,
  currentMembers,
  isInHistory,
  personRefs,
  refOf,
  type Client,
  type CurrentMember,
} from "./people";

export interface SettlementServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
}

/**
 * Both people in a payment must be current members or appear in the household's history, so a
 * remaining member can settle up with someone who moved out. Anyone else is "not found",
 * without saying whether they exist elsewhere.
 */
async function assertInHousehold(
  client: Client,
  householdId: string,
  members: readonly CurrentMember[],
  userId: string,
) {
  if (members.some((member) => member.userId === userId)) return;
  if (!(await isInHistory(client, householdId, userId))) throw badRequest("settlement.person.not_found");
}

/** A live payment of the household, at the version the caller saw. */
async function current(tx: Client, householdId: string, settlementId: string, version: number): Promise<Settlement> {
  const row = await tx.settlement.findFirst({ where: { id: settlementId, householdId, deletedAt: null } });
  if (!row) throw notFound("settlement.not_found");
  if (row.version !== version) throw conflict("settlement.changed");
  return row;
}

export function createSettlementService({ db, now = () => new Date() }: SettlementServiceDeps) {
  async function toView(client: Client, row: Settlement, members?: readonly CurrentMember[]): Promise<SettlementView> {
    const current = members ?? (await currentMembers(client, row.householdId));
    const refs = await personRefs(client, current, [
      row.fromUserId,
      row.toUserId,
      row.createdById,
      ...(row.editedById ? [row.editedById] : []),
    ]);
    return {
      id: row.id,
      from: refOf(refs, row.fromUserId),
      to: refOf(refs, row.toUserId),
      amountCents: row.amountCents,
      date: toCalendarDate(row.date),
      createdBy: refOf(refs, row.createdById),
      createdAt: row.createdAt.toISOString(),
      editedBy: row.editedById ? refOf(refs, row.editedById) : null,
      editedAt: row.editedAt?.toISOString() ?? null,
      version: row.version,
    };
  }

  return {
    /** A live payment of the caller's household; anything else is "not found". */
    async get(householdId: string, settlementId: string): Promise<SettlementView> {
      const row = await db.settlement.findFirst({ where: { id: settlementId, householdId, deletedAt: null } });
      if (!row) throw notFound("settlement.not_found");
      return toView(db, row);
    },

    /** Records money that changed hands outside the app. It may be more than what's owed. */
    async create(actor: Membership, input: SettlementInput): Promise<SettlementView> {
      assertNotFuture(input.date, now());
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await currentMembers(tx, actor.householdId);
        assertStillEditor(members, actor);
        await assertInHousehold(tx, actor.householdId, members, input.fromUserId);
        await assertInHousehold(tx, actor.householdId, members, input.toUserId);
        const row = await tx.settlement.create({
          data: {
            householdId: actor.householdId,
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            amountCents: input.amountCents,
            date: fromCalendarDate(input.date),
            createdById: actor.userId,
            createdAt: now(),
          },
        });
        return toView(tx, row, members);
      });
    },

    /** Any editor may change a payment, from the version they saw (409 otherwise). */
    async update(actor: Membership, settlementId: string, input: UpdateSettlementInput): Promise<SettlementView> {
      assertNotFuture(input.date, now());
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await currentMembers(tx, actor.householdId);
        assertStillEditor(members, actor);
        const existing = await current(tx, actor.householdId, settlementId, input.version);
        // The people already in this payment may stay, even if they've left since.
        const keep = new Set([existing.fromUserId, existing.toUserId]);
        for (const userId of [input.fromUserId, input.toUserId]) {
          if (!keep.has(userId)) await assertInHousehold(tx, actor.householdId, members, userId);
        }
        const row = await tx.settlement.update({
          where: { id: settlementId },
          data: {
            fromUserId: input.fromUserId,
            toUserId: input.toUserId,
            amountCents: input.amountCents,
            date: fromCalendarDate(input.date),
            editedById: actor.userId,
            editedAt: now(),
            version: { increment: 1 },
          },
        });
        return toView(tx, row, members);
      });
    },

    /** Like expenses, a deleted payment stops counting but stays in the history with who deleted it. */
    async remove(actor: Membership, settlementId: string, version: number): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        assertStillEditor(await currentMembers(tx, actor.householdId), actor);
        await current(tx, actor.householdId, settlementId, version);
        await tx.settlement.update({
          where: { id: settlementId },
          data: { deletedAt: now(), deletedById: actor.userId },
        });
      });
    },
  };
}

export type SettlementService = ReturnType<typeof createSettlementService>;
