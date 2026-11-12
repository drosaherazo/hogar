import { z } from "zod";
import type { ErrorCode } from "./errors";
import { weightSchema } from "./household";

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

// ---------------------------------------------------------------------------
// Names, emoji and limits
// ---------------------------------------------------------------------------

/** Sanity limits, not business rules (spec Assumptions). */
export const CATEGORY_NAME_MAX = 30;
export const MAX_CATEGORIES = 30;
/** A single emoji grapheme is short; this only guards against pasted text. */
const CATEGORY_EMOJI_MAX_UNITS = 16;

export const categoryNameSchema = z
  .string(code("request.invalid"))
  .trim()
  .min(1, code("category.name.required"))
  .max(CATEGORY_NAME_MAX, code("category.name.too_long"));

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const EMOJI_CODE_POINT = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/**
 * True for exactly one emoji as people perceive it: one grapheme (so flags, skin tones and
 * ZWJ families count as one) that contains an emoji code point.
 */
export function isSingleEmoji(value: string): boolean {
  if (value.length === 0 || value.length > CATEGORY_EMOJI_MAX_UNITS) return false;
  const segments = [...graphemes.segment(value)];
  return segments.length === 1 && EMOJI_CODE_POINT.test(value);
}

/** One emoji, or `null` for none. An empty (or blank) string also means none. */
export const categoryEmojiSchema = z
  .string(code("category.emoji.invalid"))
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || isSingleEmoji(value), { message: code("category.emoji.invalid") });

const optionalEmojiSchema = z.union([z.null(), categoryEmojiSchema]);

const idSchema = z.string(code("request.invalid")).min(1, code("request.invalid")).max(100, code("request.invalid"));
const versionSchema = z.number(code("request.invalid")).int(code("request.invalid")).min(1, code("request.invalid"));

// ---------------------------------------------------------------------------
// Starter set (research R4)
// ---------------------------------------------------------------------------

/**
 * Every new household starts with these, named in its creator's language; existing households
 * got them once from the migration. After that they are ordinary categories. The migration's
 * SQL repeats these values, and a test keeps both in sync.
 */
export const STARTER_CATEGORIES = [
  { emoji: "🏠", name: { en: "Rent", es: "Alquiler" } },
  { emoji: "🛒", name: { en: "Groceries", es: "Comida" } },
  { emoji: "💡", name: { en: "Utilities", es: "Suministros" } },
  { emoji: "🎉", name: { en: "Leisure", es: "Ocio" } },
  { emoji: "📦", name: { en: "Other", es: "Otros" } },
] as const satisfies readonly { emoji: string; name: { en: string; es: string } }[];

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const createCategoryInputSchema = z.object({
  name: categoryNameSchema,
  emoji: optionalEmojiSchema.optional().transform((value) => value ?? null),
});
export type CreateCategoryInput = z.input<typeof createCategoryInputSchema>;

/** A change carries the version it started from, so it can't overwrite a change it hasn't seen. */
export const updateCategoryInputSchema = z.object({
  name: categoryNameSchema,
  emoji: optionalEmojiSchema,
  version: versionSchema,
});
export type UpdateCategoryInput = z.input<typeof updateCategoryInputSchema>;

/**
 * The "use its own split" box. Ticked: one weight per current member (validated against the
 * memberships on the server), not all 0. Unticked: the category follows the household again.
 */
export const updateCategorySplitInputSchema = z.discriminatedUnion("ownSplit", [
  z.object({ version: versionSchema, ownSplit: z.literal(false) }),
  z.object({
    version: versionSchema,
    ownSplit: z.literal(true),
    weights: z
      .array(z.object({ membershipId: idSchema, weight: weightSchema }))
      .min(1, code("split.members_changed"))
      .refine((weights) => new Set(weights.map((entry) => entry.membershipId)).size === weights.length, {
        message: code("split.members_changed"),
      })
      .refine((weights) => weights.some((entry) => entry.weight > 0), { message: code("split.all_zero") }),
  }),
]);
export type UpdateCategorySplitInput = z.infer<typeof updateCategorySplitInputSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** What an expense shows of its category. */
export const categoryRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().nullable(),
});
export type CategoryRef = z.infer<typeof categoryRefSchema>;

export const categoryWeightViewSchema = z.object({
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  weight: z.number().int(),
  /** Share of the category's split in basis points (10000 = 100 %); 0 for everyone if all weights are 0. */
  shareBps: z.number().int(),
});
export type CategoryWeightView = z.infer<typeof categoryWeightViewSchema>;

export const categoryViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().nullable(),
  position: z.number().int(),
  ownSplit: z.boolean(),
  /** In member order; `null` while the category follows the household's split. */
  weights: z.array(categoryWeightViewSchema).nullable(),
  /** Members changed since an admin last saved this category's own split (or it's all 0). */
  needsReview: z.boolean(),
  /** Live expenses in this category, for the delete confirmation. */
  expenseCount: z.number().int().min(0),
  version: z.number().int().min(1),
});
export type CategoryView = z.infer<typeof categoryViewSchema>;

export const categoryListSchema = z.object({ categories: z.array(categoryViewSchema) });
export type CategoryList = z.infer<typeof categoryListSchema>;

export const categoryResponseSchema = z.object({ category: categoryViewSchema });
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
