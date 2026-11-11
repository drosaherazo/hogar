import { z } from "zod";
import type { ErrorCode } from "./errors";

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

// ---------------------------------------------------------------------------
// Money, dates and descriptions
// ---------------------------------------------------------------------------

/** €100,000.00: a guard against typing mistakes, not a business rule. */
export const MAX_AMOUNT_CENTS = 10_000_000;
export const EXPENSE_DESCRIPTION_MAX = 100;
/** History items per page, and the most a client may ask for. */
export const ACTIVITY_PAGE_SIZE = 30;
export const ACTIVITY_PAGE_MAX = 50;

/** Money is always a whole number of euro cents; it is formatted only when displayed. */
export const moneyCentsSchema = z
  .number(code("money.amount.invalid"))
  .int(code("money.amount.invalid"))
  .min(1, code("money.amount.invalid"))
  .max(MAX_AMOUNT_CENTS, code("money.amount.invalid"));

/** A person's part of an expense can be €0.00 (an equal split of a tiny amount). */
const shareCentsSchema = z
  .number(code("money.amount.invalid"))
  .int(code("money.amount.invalid"))
  .min(0, code("money.amount.invalid"))
  .max(MAX_AMOUNT_CENTS, code("money.amount.invalid"));

/** A calendar day, `YYYY-MM-DD`, without a time of day. */
export const calendarDateSchema = z.iso.date(code("money.date.invalid"));

export const expenseDescriptionSchema = z
  .string(code("request.invalid"))
  .trim()
  .min(1, code("expense.description.required"))
  .max(EXPENSE_DESCRIPTION_MAX, code("expense.description.too_long"));

const userIdSchema = z
  .string(code("request.invalid"))
  .min(1, code("request.invalid"))
  .max(100, code("request.invalid"));
const versionSchema = z.number(code("request.invalid")).int(code("request.invalid")).min(1, code("request.invalid"));

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------

export const SPLIT_METHODS = ["WEIGHTS", "EQUAL", "EXACT"] as const;
export const splitMethodSchema = z.enum(SPLIT_METHODS);
export type SplitMethod = z.infer<typeof splitMethodSchema>;

const unique = (values: readonly string[]) => new Set(values).size === values.length;

/**
 * How an expense is split:
 * - `WEIGHTS`: the household's split, from the members' weights when it's saved;
 * - `EQUAL`: equally among the chosen people;
 * - `EXACT`: an amount per person, adding up to the total.
 */
export const expenseSplitInputSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("WEIGHTS") }),
  z.object({
    method: z.literal("EQUAL"),
    userIds: z
      .array(userIdSchema)
      .min(1, code("expense.split.invalid"))
      .refine(unique, { message: code("expense.split.invalid") }),
  }),
  z.object({
    method: z.literal("EXACT"),
    shares: z
      .array(z.object({ userId: userIdSchema, amountCents: shareCentsSchema }))
      .min(1, code("expense.split.invalid"))
      .refine((shares) => unique(shares.map((share) => share.userId)), { message: code("expense.split.invalid") }),
  }),
]);
export type ExpenseSplitInput = z.infer<typeof expenseSplitInputSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const expenseFields = {
  description: expenseDescriptionSchema,
  amountCents: moneyCentsSchema,
  paidById: userIdSchema,
  date: calendarDateSchema,
  split: expenseSplitInputSchema,
};

/** Exact amounts must add up to the total; the other methods compute shares that always do. */
function exactAmountsAddUp(input: { amountCents: number; split: ExpenseSplitInput }, ctx: z.RefinementCtx) {
  if (input.split.method !== "EXACT") return;
  const sum = input.split.shares.reduce((total, share) => total + share.amountCents, 0);
  if (sum !== input.amountCents) {
    ctx.addIssue({ code: "custom", message: code("expense.split.mismatch"), path: ["split", "shares"] });
  }
}

export const expenseInputSchema = z.object(expenseFields).superRefine(exactAmountsAddUp);
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

/** An edit carries the version it started from, so it can't overwrite a change it hasn't seen. */
export const updateExpenseInputSchema = z
  .object({ ...expenseFields, version: versionSchema })
  .superRefine(exactAmountsAddUp);
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

const settlementFields = {
  fromUserId: userIdSchema,
  toUserId: userIdSchema,
  amountCents: moneyCentsSchema,
  date: calendarDateSchema,
};

const differentPeople = (input: { fromUserId: string; toUserId: string }) => input.fromUserId !== input.toUserId;

/** A payment from one person to another to settle up ("settlement" in code, "payment" on screen). */
export const settlementInputSchema = z
  .object(settlementFields)
  .refine(differentPeople, { message: code("settlement.same_person"), path: ["toUserId"] });
export type SettlementInput = z.infer<typeof settlementInputSchema>;

export const updateSettlementInputSchema = z
  .object({ ...settlementFields, version: versionSchema })
  .refine(differentPeople, { message: code("settlement.same_person"), path: ["toUserId"] });
export type UpdateSettlementInput = z.infer<typeof updateSettlementInputSchema>;

/** Query string of `GET /api/household/activity`. */
export const activityQuerySchema = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(ACTIVITY_PAGE_MAX).default(ACTIVITY_PAGE_SIZE),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

/** Someone who appears in the money history. `former`: no longer a member of the household. */
export const personRefSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.url().nullable(),
  former: z.boolean(),
});
export type PersonRef = z.infer<typeof personRefSchema>;

/** Who deleted a record and when; deleted records stay in the history but no longer count. */
export const deletionSchema = z.object({ by: personRefSchema, at: z.iso.datetime() });
export type Deletion = z.infer<typeof deletionSchema>;

const auditFields = {
  createdBy: personRefSchema,
  createdAt: z.iso.datetime(),
  editedBy: personRefSchema.nullable(),
  editedAt: z.iso.datetime().nullable(),
  version: z.number().int().min(1),
};

export const expenseShareViewSchema = z.object({ person: personRefSchema, amountCents: z.number().int().min(0) });
export type ExpenseShareView = z.infer<typeof expenseShareViewSchema>;

export const expenseViewSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  amountCents: z.number().int(),
  date: z.iso.date(),
  paidBy: personRefSchema,
  /** Shares in member order (former members last); they add up to `amountCents`. */
  split: z.object({ method: splitMethodSchema, shares: z.array(expenseShareViewSchema) }),
  ...auditFields,
});
export type ExpenseView = z.infer<typeof expenseViewSchema>;

export const expenseResponseSchema = z.object({ expense: expenseViewSchema });
export type ExpenseResponse = z.infer<typeof expenseResponseSchema>;

export const settlementViewSchema = z.object({
  id: z.string().min(1),
  from: personRefSchema,
  to: personRefSchema,
  amountCents: z.number().int(),
  date: z.iso.date(),
  ...auditFields,
});
export type SettlementView = z.infer<typeof settlementViewSchema>;

export const settlementResponseSchema = z.object({ settlement: settlementViewSchema });
export type SettlementResponse = z.infer<typeof settlementResponseSchema>;

export const viewerPartSchema = z.object({
  kind: z.enum(["owes", "lent", "none"]),
  amountCents: z.number().int().min(0),
});

export const activityItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("expense"),
    id: z.string().min(1),
    description: z.string().min(1),
    amountCents: z.number().int(),
    date: z.iso.date(),
    paidBy: personRefSchema,
    /** Always `none` for a deleted expense. */
    viewerPart: viewerPartSchema,
    deleted: deletionSchema.nullable(),
  }),
  z.object({
    kind: z.literal("settlement"),
    id: z.string().min(1),
    amountCents: z.number().int(),
    date: z.iso.date(),
    from: personRefSchema,
    to: personRefSchema,
    deleted: deletionSchema.nullable(),
  }),
]);
export type ActivityItem = z.infer<typeof activityItemSchema>;

/** Newest first: date, then when it was recorded, then id. */
export const activityPageSchema = z.object({ items: z.array(activityItemSchema), nextCursor: z.string().nullable() });
export type ActivityPage = z.infer<typeof activityPageSchema>;

/** `balanceCents` > 0: is owed money; < 0: owes. Shown in words, never as a bare sign. */
export const personBalanceSchema = z.object({ person: personRefSchema, balanceCents: z.number().int() });
export type PersonBalance = z.infer<typeof personBalanceSchema>;

export const suggestedSettlementSchema = z.object({
  from: personRefSchema,
  to: personRefSchema,
  amountCents: z.number().int().positive(),
});
export type SuggestedSettlement = z.infer<typeof suggestedSettlementSchema>;

/** Current members in member order (even at zero), then former members who still owe or are owed. */
export const balancesViewSchema = z.object({
  balances: z.array(personBalanceSchema),
  suggestions: z.array(suggestedSettlementSchema),
  myBalanceCents: z.number().int(),
});
export type BalancesView = z.infer<typeof balancesViewSchema>;
