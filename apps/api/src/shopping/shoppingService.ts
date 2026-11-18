import { SHOPPING_UNDO_WINDOW_MS, shoppingNameKey, type ShoppingItemView } from "@hogar/shared";
import type { Database } from "../db";
import { currentMembers, personRefs, refOf, type Client } from "../expenses/people";
import type { Membership, Prisma, ShoppingItem } from "../generated/prisma/client";
import { isUniqueViolation } from "../household/householdService";
import { conflict, gone, notFound } from "../httpError";
import { noHouseholdEvents, type HouseholdEvents } from "../realtime/householdEvents";

export interface ShoppingServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
  /** Where every list and cart change is announced, once it is saved. */
  events?: HouseholdEvents;
}

export interface NewShoppingItem {
  name: string;
  note: string | null;
}

/** What an edit changes: a missing field stays as it is. */
export interface ShoppingItemChanges {
  name?: string | undefined;
  note?: string | null | undefined;
  version: number;
}

/**
 * The household's shopping list. Everyone in the household reads it; admins and members add to it
 * (the router checks the role). The server decides every conflict (ADR 0009): the database's
 * unique index on the name key is what refuses a duplicate, however close two adds arrive.
 * Every change that is saved is announced to the household as `shopping:changed`.
 */
export function createShoppingService({ db, now = () => new Date(), events = noHouseholdEvents }: ShoppingServiceDeps) {
  /** What everyone sees of `rows`: who asked only while the household shows it (it stays stored either way). */
  async function viewsOf(client: Client, householdId: string, rows: ShoppingItem[]): Promise<ShoppingItemView[]> {
    const { showWhoAsked } = await client.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { showWhoAsked: true },
    });
    const members = await currentMembers(client, householdId);
    const refs = await personRefs(
      client,
      members,
      rows.map((row) => row.askedById),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note,
      ...(showWhoAsked && { askedBy: refOf(refs, row.askedById) }),
      addedAt: row.addedAt.toISOString(),
      version: row.version,
    }));
  }

  /**
   * An item of the caller's household, deleted or not, locked until the transaction ends, so
   * changes to the same item take turns and each one sees the last.
   */
  async function lockedItem(tx: Prisma.TransactionClient, householdId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM shopping_items WHERE id = ${id} FOR UPDATE`;
    return tx.shoppingItem.findFirst({ where: { id, householdId } });
  }

  /** The same, for an item on the list: a deleted item is gone for everyone. */
  async function lockedItemOnList(tx: Prisma.TransactionClient, householdId: string, id: string) {
    const row = await lockedItem(tx, householdId, id);
    if (!row || row.deletedAt !== null) throw notFound("shopping.item.not_found");
    return row;
  }

  async function viewOf(householdId: string, row: ShoppingItem): Promise<ShoppingItemView> {
    const [view] = await viewsOf(db, householdId, [row]);
    if (!view) throw new Error("Every item has a view");
    return view;
  }

  /**
   * The unique index on the name key refuses a second item with the same name on the list. A
   * violation aborts the transaction, so it is caught here, outside it.
   */
  async function refusingDuplicates<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("shopping.item.duplicate");
      throw error;
    }
  }

  return {
    /** The items on the list in the order they were added, like a paper list. */
    async list(householdId: string): Promise<ShoppingItemView[]> {
      const rows = await db.shoppingItem.findMany({
        where: { householdId, deletedAt: null },
        orderBy: [{ addedAt: "asc" }, { id: "asc" }],
      });
      return viewsOf(db, householdId, rows);
    },

    /** A new item goes last, asked for by whoever adds it. */
    async add(actor: Membership, input: NewShoppingItem): Promise<ShoppingItemView> {
      const row = await refusingDuplicates(() =>
        db.shoppingItem.create({
          data: {
            householdId: actor.householdId,
            name: input.name,
            nameKey: shoppingNameKey(input.name),
            note: input.note,
            askedById: actor.userId,
            addedAt: now(),
          },
        }),
      );
      events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },

    /**
     * Renames the item or changes its note. The edit names the version it started from, and one
     * based on an older version is refused, so nobody overwrites a change they haven't seen
     * (ADR 0009). Saving what is already there changes nothing, not even the version.
     */
    async edit(actor: Membership, id: string, changes: ShoppingItemChanges): Promise<ShoppingItemView> {
      const { row, changed } = await refusingDuplicates(() =>
        db.$transaction(async (tx) => {
          const current = await lockedItemOnList(tx, actor.householdId, id);
          if (current.version !== changes.version) throw conflict("shopping.item.changed");
          const name = changes.name ?? current.name;
          const note = changes.note === undefined ? current.note : changes.note;
          if (name === current.name && note === current.note) return { row: current, changed: false };
          const edited = await tx.shoppingItem.update({
            where: { id },
            data: { name, nameKey: shoppingNameKey(name), note, version: { increment: 1 } },
          });
          return { row: edited, changed: true };
        }),
      );
      if (changed) events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },

    /** Takes the item off the list at once; whoever deleted it can undo for a while. */
    async remove(actor: Membership, id: string, version: number): Promise<void> {
      await db.$transaction(async (tx) => {
        const row = await lockedItemOnList(tx, actor.householdId, id);
        if (row.version !== version) throw conflict("shopping.item.changed");
        await tx.shoppingItem.update({ where: { id }, data: { deletedAt: now(), deletedById: actor.userId } });
      });
      events.publish(actor.householdId, "shopping:changed");
    },

    /**
     * Undoes the caller's own delete within the window: the item comes back in its place, as it
     * was. For anyone else a deleted item leaves no trace, so they get `not_found`. A second tap
     * finds the item already back and changes nothing.
     */
    async restore(actor: Membership, id: string): Promise<ShoppingItemView> {
      const { row, restored } = await refusingDuplicates(() =>
        db.$transaction(async (tx) => {
          const current = await lockedItem(tx, actor.householdId, id);
          if (current?.deletedAt === null) return { row: current, restored: false };
          if (!current?.deletedAt || current.deletedById !== actor.userId) throw notFound("shopping.item.not_found");
          if (now().getTime() - current.deletedAt.getTime() > SHOPPING_UNDO_WINDOW_MS) {
            throw gone("shopping.undo.expired");
          }
          const back = await tx.shoppingItem.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
          return { row: back, restored: true };
        }),
      );
      if (restored) events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },
  };
}

export type ShoppingService = ReturnType<typeof createShoppingService>;
