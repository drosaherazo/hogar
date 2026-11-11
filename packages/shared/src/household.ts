import { z } from "zod";
import type { ErrorCode } from "./errors";

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

// ---------------------------------------------------------------------------
// Roles, names and weights
// ---------------------------------------------------------------------------

export const ROLES = ["ADMIN", "MEMBER", "GUEST"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Invitations never grant ADMIN; people are promoted after joining. */
export const invitableRoleSchema = z.enum(["MEMBER", "GUEST"]);
export type InvitableRole = z.infer<typeof invitableRoleSchema>;

export const HOUSEHOLD_NAME_MAX = 50;

export const householdNameSchema = z
  .string(code("request.invalid"))
  .trim()
  .min(1, code("household.name.required"))
  .max(HOUSEHOLD_NAME_MAX, code("household.name.too_long"));

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 100;

export const weightSchema = z
  .number(code("split.weight.invalid"))
  .int(code("split.weight.invalid"))
  .min(WEIGHT_MIN, code("split.weight.invalid"))
  .max(WEIGHT_MAX, code("split.weight.invalid"));

/** Weight someone starts with when they join: guests only read, so they don't pay. */
export function defaultWeightFor(role: Role): number {
  return role === "GUEST" ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const createHouseholdRequestSchema = z.object({ name: householdNameSchema });
export type CreateHouseholdRequest = z.infer<typeof createHouseholdRequestSchema>;

export const renameHouseholdRequestSchema = createHouseholdRequestSchema;
export type RenameHouseholdRequest = CreateHouseholdRequest;

export const createInvitationRequestSchema = z.object({ role: invitableRoleSchema });
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

/** Invitation tokens travel in request bodies, never in URLs, so they stay out of access logs. */
export const invitationTokenRequestSchema = z.object({ token: z.string().min(1).max(200) });
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>;

export const changeRoleRequestSchema = z.object({ role: roleSchema });
export type ChangeRoleRequest = z.infer<typeof changeRoleRequestSchema>;

export const updateSplitRequestSchema = z.object({
  weights: z
    .array(z.object({ membershipId: z.string().min(1), weight: weightSchema }))
    .min(1)
    .refine((weights) => new Set(weights.map((entry) => entry.membershipId)).size === weights.length, {
      message: code("split.members_changed"),
    })
    .refine((weights) => weights.some((entry) => entry.weight > 0), { message: code("split.all_zero") }),
});
export type UpdateSplitRequest = z.infer<typeof updateSplitRequestSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const memberViewSchema = z.object({
  /** The membership id: what member endpoints take. */
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.url().nullable(),
  role: roleSchema,
  weight: z.number().int(),
  /** Share of the default split in basis points (10000 = 100 %). */
  shareBps: z.number().int(),
  joinedAt: z.iso.datetime(),
});
export type MemberView = z.infer<typeof memberViewSchema>;

export const householdViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  myMembershipId: z.string().min(1),
  myRole: roleSchema,
  /** Ordered by when people joined; this order also decides who gets leftover cents. */
  members: z.array(memberViewSchema),
  splitNeedsReview: z.boolean(),
});
export type HouseholdView = z.infer<typeof householdViewSchema>;

export const householdResponseSchema = z.object({ household: householdViewSchema });
export type HouseholdResponse = z.infer<typeof householdResponseSchema>;

export const currentHouseholdSchema = z.union([
  householdResponseSchema,
  z.object({ household: z.null(), removedFrom: z.string().nullable() }),
]);
export type CurrentHousehold = z.infer<typeof currentHouseholdSchema>;

export const invitationViewSchema = z.object({
  id: z.string().min(1),
  role: invitableRoleSchema,
  createdByName: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  status: z.enum(["pending", "expired"]),
});
export type InvitationView = z.infer<typeof invitationViewSchema>;

export const invitationListSchema = z.object({ invitations: z.array(invitationViewSchema) });
export type InvitationList = z.infer<typeof invitationListSchema>;

/** The only response that ever carries the token: it can't be recovered later (it's stored hashed). */
export const createdInvitationSchema = z.object({ invitation: invitationViewSchema, token: z.string().min(1) });
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const invitationPreviewSchema = z.object({
  householdName: z.string().min(1),
  inviterName: z.string().nullable(),
  role: invitableRoleSchema,
  expiresAt: z.iso.datetime(),
  viewer: z.enum(["can_join", "already_member", "has_other_household"]),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

/** Invitation links work once and for this long. */
export const INVITATION_TTL_HOURS = 12;
/** A household can't have more pending invitations than this at once. */
export const MAX_PENDING_INVITATIONS = 10;
