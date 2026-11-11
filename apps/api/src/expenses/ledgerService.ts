import { viewerPart, type ActivityItem, type ActivityPage, type ActivityQuery, type PersonRef } from "@hogar/shared";
import type { Database } from "../db";
import type { Prisma } from "../generated/prisma/client";
import { badRequest } from "../httpError";
import { fromCalendarDate, toCalendarDate } from "./dates";
import { currentMembers, personRefs, refOf } from "./people";

/** Where a page ends: the sort key of its last item. */
interface Cursor {
  date: Date;
  createdAt: Date;
  id: string;
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

function encodeCursor({ date, createdAt, id }: Cursor): string {
  return Buffer.from(JSON.stringify([toCalendarDate(date), createdAt.toISOString(), id])).toString("base64url");
}

/** Reads a cursor this service made; anything else is a bad request. */
function decodeCursor(value: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 3) {
      const [day, createdAt, id] = parsed as unknown[];
      if (
        typeof day === "string" &&
        CALENDAR_DAY.test(day) &&
        typeof createdAt === "string" &&
        typeof id === "string"
      ) {
        const cursor = { date: fromCalendarDate(day), createdAt: new Date(createdAt), id };
        if (!Number.isNaN(cursor.date.getTime()) && !Number.isNaN(cursor.createdAt.getTime()) && id.length > 0) {
          return cursor;
        }
      }
    }
  } catch {
    // Not base64 JSON: fall through.
  }
  throw badRequest("request.invalid");
}

/** Records strictly after the cursor in "newest first" order (date, then createdAt, then id, all descending). */
function after(cursor: Cursor | undefined) {
  if (!cursor) return {};
  const { date, createdAt, id } = cursor;
  return {
    OR: [{ date: { lt: date } }, { date, createdAt: { lt: createdAt } }, { date, createdAt, id: { lt: id } }],
  };
}

const NEWEST_FIRST = [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }] as const satisfies (
  Prisma.ExpenseOrderByWithRelationInput | Prisma.SettlementOrderByWithRelationInput
)[];

/** The same order as `NEWEST_FIRST`, for merging the two tables in memory. */
function newestFirst(a: Cursor, b: Cursor): number {
  return (
    b.date.getTime() - a.date.getTime() ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
  );
}

export interface LedgerServiceDeps {
  db: Database;
}

/** Reads across expenses and settlements: the shared history (and, later, balances). */
export function createLedgerService({ db }: LedgerServiceDeps) {
  return {
    /**
     * One page of the household's history, expenses and payments together, newest first.
     * Keyset pagination: each table gives `limit + 1` rows after the cursor, the two are merged
     * and the first `limit` returned, so records added meanwhile never shift later pages.
     * Deleted records stay in the history (with who deleted them) but never count.
     */
    async activity(householdId: string, viewerId: string, query: ActivityQuery): Promise<ActivityPage> {
      const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
      const take = query.limit + 1;
      const [expenses, settlements] = await Promise.all([
        db.expense.findMany({
          where: { householdId, ...after(cursor) },
          orderBy: NEWEST_FIRST,
          take,
          include: { shares: true },
        }),
        db.settlement.findMany({ where: { householdId, ...after(cursor) }, orderBy: NEWEST_FIRST, take }),
      ]);

      type Row =
        { kind: "expense"; row: (typeof expenses)[number] } | { kind: "settlement"; row: (typeof settlements)[number] };
      const merged: Row[] = [
        ...expenses.map((row) => ({ kind: "expense" as const, row })),
        ...settlements.map((row) => ({ kind: "settlement" as const, row })),
      ].sort((a, b) => newestFirst(a.row, b.row));
      const page = merged.slice(0, query.limit);

      const members = await currentMembers(db, householdId);
      const refs = await personRefs(
        db,
        members,
        page.flatMap(({ kind, row }) => [
          ...(kind === "expense" ? [row.paidById] : [row.fromUserId, row.toUserId]),
          ...(row.deletedById ? [row.deletedById] : []),
        ]),
      );
      const deletion = (row: { deletedAt: Date | null; deletedById: string | null }) =>
        row.deletedAt && row.deletedById ? { by: refOf(refs, row.deletedById), at: row.deletedAt.toISOString() } : null;
      const ref = (userId: string): PersonRef => refOf(refs, userId);

      const items: ActivityItem[] = page.map(({ kind, row }) =>
        kind === "expense"
          ? {
              kind,
              id: row.id,
              description: row.description,
              amountCents: row.amountCents,
              date: toCalendarDate(row.date),
              paidBy: ref(row.paidById),
              viewerPart: row.deletedAt ? { kind: "none", amountCents: 0 } : viewerPart(row, viewerId),
              deleted: deletion(row),
            }
          : {
              kind,
              id: row.id,
              amountCents: row.amountCents,
              date: toCalendarDate(row.date),
              from: ref(row.fromUserId),
              to: ref(row.toUserId),
              deleted: deletion(row),
            },
      );

      const last = page.at(-1);
      return { items, nextCursor: merged.length > query.limit && last ? encodeCursor(last.row) : null };
    },
  };
}

export type LedgerService = ReturnType<typeof createLedgerService>;
