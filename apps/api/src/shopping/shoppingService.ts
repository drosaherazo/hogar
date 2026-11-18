import { shoppingNameKey, type ShoppingItemView } from "@hogar/shared";
import type { Database } from "../db";
import { currentMembers, personRefs, refOf, type Client } from "../expenses/people";
import type { Membership, ShoppingItem } from "../generated/prisma/client";
import { isUniqueViolation } from "../household/householdService";
import { conflict } from "../httpError";
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

  return {
    /** The items on the list in the order they were added, like a paper list. */
    async list(householdId: string): Promise<ShoppingItemView[]> {
      const rows = await db.shoppingItem.findMany({
        where: { householdId },
        orderBy: [{ addedAt: "asc" }, { id: "asc" }],
      });
      return viewsOf(db, householdId, rows);
    },

    /** A new item goes last, asked for by whoever adds it. */
    async add(actor: Membership, input: NewShoppingItem): Promise<ShoppingItemView> {
      try {
        const row = await db.shoppingItem.create({
          data: {
            householdId: actor.householdId,
            name: input.name,
            nameKey: shoppingNameKey(input.name),
            note: input.note,
            askedById: actor.userId,
            addedAt: now(),
          },
        });
        events.publish(actor.householdId, "shopping:changed");
        const [view] = await viewsOf(db, actor.householdId, [row]);
        if (!view) throw new Error("A created item has a view");
        return view;
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict("shopping.item.duplicate");
        throw error;
      }
    },
  };
}

export type ShoppingService = ReturnType<typeof createShoppingService>;
