import { z } from "zod";
import type { ErrorCode } from "./errors";
import { personRefSchema } from "./expenses";

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

// ---------------------------------------------------------------------------
// Names, notes and limits
// ---------------------------------------------------------------------------

/** Names stay short enough to scan in a shop; details go in the note. */
export const SHOPPING_ITEM_NAME_MAX = 50;
export const SHOPPING_ITEM_NOTE_MAX = 100;

/**
 * The one normalisation behind "never two items with the same name at once" (ADR 0009): the API's
 * uniqueness check stores it, and the web uses it to find the item behind a duplicate notice.
 * Case is folded the way people read it (upper- then lower-casing, so "ß" matches "SS"), every
 * accent and other combining mark goes (ñ too, so someone typing without it still finds "Piña"),
 * and spaces are trimmed and collapsed.
 */
export function shoppingNameKey(name: string): string {
  return name.toUpperCase().toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/gu, " ").trim();
}

export const shoppingItemNameSchema = z
  .string(code("request.invalid"))
  .trim()
  .min(1, code("shopping.item.name.required"))
  .max(SHOPPING_ITEM_NAME_MAX, code("shopping.item.name.too_long"));

/** Optional: missing, null, empty and blank all mean no note. */
export const shoppingItemNoteSchema = z
  .string(code("request.invalid"))
  .trim()
  .max(SHOPPING_ITEM_NOTE_MAX, code("shopping.item.note.too_long"))
  .nullish()
  .transform((value) => value || null);

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const addShoppingItemInputSchema = z.object({
  name: shoppingItemNameSchema,
  note: shoppingItemNoteSchema,
});
export type AddShoppingItemInput = z.input<typeof addShoppingItemInputSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const shoppingItemViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string().nullable(),
  /** Whoever added it. People are users, so a former member keeps their name (ADR 0007). */
  askedBy: personRefSchema,
  addedAt: z.iso.datetime(),
  version: z.number().int().min(1),
});
export type ShoppingItemView = z.infer<typeof shoppingItemViewSchema>;

/** The items on the list, in the order they were added. */
export const shoppingListSchema = z.object({ items: z.array(shoppingItemViewSchema) });
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export const shoppingItemResponseSchema = z.object({ item: shoppingItemViewSchema });
export type ShoppingItemResponse = z.infer<typeof shoppingItemResponseSchema>;
