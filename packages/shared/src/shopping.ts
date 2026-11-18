import { z } from "zod";
import type { ErrorCode } from "./errors";
import { expenseInputSchema, expenseViewSchema, personRefSchema } from "./expenses";

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

// ---------------------------------------------------------------------------
// Names, notes and limits
// ---------------------------------------------------------------------------

/** Names stay short enough to scan in a shop; details go in the note. */
export const SHOPPING_ITEM_NAME_MAX = 50;
export const SHOPPING_ITEM_NOTE_MAX = 100;

/**
 * How long whoever deleted an item can bring it back. The web's "Undo" toast lasts much less;
 * the extra time covers a toast paused while someone reads it and a slow connection in a shop.
 */
export const SHOPPING_UNDO_WINDOW_MS = 60_000;

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

const versionSchema = z.number(code("request.invalid")).int(code("request.invalid")).min(1, code("request.invalid"));

/**
 * An edit changes the name, the note or both, and carries the version it started from, so it can't
 * overwrite a change it hasn't seen (ADR 0009). A missing field stays as it is; an empty or null
 * note removes it.
 */
export const updateShoppingItemInputSchema = z
  .object({
    name: shoppingItemNameSchema.optional(),
    note: z
      .string(code("request.invalid"))
      .trim()
      .max(SHOPPING_ITEM_NOTE_MAX, code("shopping.item.note.too_long"))
      .nullable()
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
    version: versionSchema,
  })
  .refine((input) => input.name !== undefined || input.note !== undefined, { message: code("request.invalid") });
export type UpdateShoppingItemInput = z.input<typeof updateShoppingItemInputSchema>;

/** Items named by id, each once. */
const itemIdsSchema = z
  .array(z.string(code("request.invalid")).min(1, code("request.invalid")), code("request.invalid"))
  .min(1, code("request.invalid"))
  .refine((ids) => new Set(ids).size === ids.length, { message: code("request.invalid") });

/**
 * Finishing shopping names every item in the caller's cart, as the person last saw it: a cart that
 * changed meanwhile (on their other device) is refused whole, never half bought. `expense` is what
 * the person paid, recorded with every expense rule, or null to finish without an expense; it is
 * required, so leaving it out never means "without one".
 */
export const finishShoppingInputSchema = z.object({
  itemIds: itemIdsSchema,
  expense: expenseInputSchema.nullable(),
});
export type FinishShoppingInput = z.input<typeof finishShoppingInputSchema>;

/** Undoing a finish names the items it bought, to put them back in the caller's cart. */
export const undoFinishShoppingInputSchema = z.object({ itemIds: itemIdsSchema });
export type UndoFinishShoppingInput = z.input<typeof undoFinishShoppingInputSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const shoppingItemViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: z.string().nullable(),
  /**
   * Whoever added it. People are users, so a former member keeps their name (ADR 0007). Left out
   * while the household hides who asked (`showWhoAsked`), though it is still stored.
   */
  askedBy: personRefSchema.optional(),
  addedAt: z.iso.datetime(),
  version: z.number().int().min(1),
  /**
   * Whose cart it is in while someone shops, or null. Only that person can take it out, change it
   * or delete it. Never a former member: leaving, being removed or becoming a guest empties a cart.
   */
  cartOwner: personRefSchema.nullable(),
});
export type ShoppingItemView = z.infer<typeof shoppingItemViewSchema>;

/**
 * The items on the list, in the order they were added, and the category of the household's last
 * purchase expense (the newest one not deleted), so the next one starts with it; null when there
 * is none, it had no category or its category was deleted.
 */
export const shoppingListSchema = z.object({
  items: z.array(shoppingItemViewSchema),
  lastCategoryId: z.string().min(1).nullable(),
});
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export const shoppingItemResponseSchema = z.object({ item: shoppingItemViewSchema });
export type ShoppingItemResponse = z.infer<typeof shoppingItemResponseSchema>;

/** Several items in list order, such as those an undo put back in the cart. */
export const shoppingItemsResponseSchema = z.object({ items: z.array(shoppingItemViewSchema) });
export type ShoppingItemsResponse = z.infer<typeof shoppingItemsResponseSchema>;

/** What finishing recorded: the expense it created, or null when the person finished without one. */
export const finishShoppingResponseSchema = z.object({ expense: expenseViewSchema.nullable() });
export type FinishShoppingResponse = z.infer<typeof finishShoppingResponseSchema>;

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/** At most this many suggestions, so the likeliest choices fit above a phone's keyboard. */
export const SHOPPING_SUGGESTIONS_MAX = 5;

/**
 * What the person has typed so far. Missing or blank matches every bought item, so the most
 * bought come first. Longer than a name can be, nothing could match: the request is refused.
 */
export const shoppingSuggestionsQuerySchema = z.object({
  q: z.string(code("request.invalid")).max(SHOPPING_ITEM_NAME_MAX, code("request.invalid")).default(""),
});
export type ShoppingSuggestionsQuery = z.infer<typeof shoppingSuggestionsQuerySchema>;

/** Something the household bought before, with the name and note of its latest purchase. */
export const shoppingSuggestionSchema = z.object({
  name: z.string().min(1),
  note: z.string().nullable(),
  timesBought: z.number().int().min(1),
});
export type ShoppingSuggestion = z.infer<typeof shoppingSuggestionSchema>;

/** The most bought first, then the most recent; never what is already on the list. */
export const shoppingSuggestionsSchema = z.object({
  suggestions: z.array(shoppingSuggestionSchema).max(SHOPPING_SUGGESTIONS_MAX),
});
export type ShoppingSuggestions = z.infer<typeof shoppingSuggestionsSchema>;
