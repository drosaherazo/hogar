import { z } from "zod";

/**
 * Error codes the API returns instead of user-facing sentences.
 * The web translates each one (`errors` namespace), so every code needs an `en` and `es` message.
 */
export const ERROR_CODES = [
  "auth.google.invalid_token",
  "auth.google.email_not_verified",
  "auth.google.already_linked",
  "auth.email.invalid",
  "auth.email.send_failed",
  "auth.code.format",
  "auth.code.wrong",
  "auth.code.expired",
  "auth.code.too_soon",
  "auth.code.daily_limit",
  "auth.session.missing",
  "auth.session.expired",
  "auth.session.reused",
  "auth.token.invalid",
  "household.name.required",
  "household.name.too_long",
  "household.already_member",
  "household.not_member",
  "household.forbidden",
  "household.read_only",
  "household.last_admin",
  "household.member_not_found",
  "invitation.not_found",
  "invitation.expired",
  "invitation.used",
  "invitation.revoked",
  "invitation.limit_reached",
  "split.weight.invalid",
  "split.all_zero",
  "split.members_changed",
  "money.amount.invalid",
  "money.date.invalid",
  "money.date.future",
  "expense.description.required",
  "expense.description.too_long",
  "expense.split.invalid",
  "expense.split.mismatch",
  "expense.split.no_default",
  "expense.person.not_member",
  "expense.not_found",
  "expense.changed",
  "expense.category.not_found",
  "expense.split.changed",
  "category.name.required",
  "category.name.too_long",
  "category.name.taken",
  "category.emoji.invalid",
  "category.limit_reached",
  "category.not_found",
  "category.changed",
  "settlement.same_person",
  "settlement.person.not_found",
  "settlement.not_found",
  "settlement.changed",
  "request.invalid",
  "request.forbidden_origin",
  "request.rate_limited",
  "server.unexpected",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorCodeSchema = z.enum(ERROR_CODES);

/** Shape of every error response body: `{ "error": { "code": "auth.token.invalid" } }`. */
export const apiErrorSchema = z.object({
  error: z.object({ code: errorCodeSchema }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * The error code of the first failed check in a Zod result. Shared schemas put codes in their
 * messages; anything else (wrong type, missing field) is a plain `request.invalid`.
 */
export function errorCodeFrom(error: { issues: readonly { message: string }[] } | undefined): ErrorCode {
  const message = error?.issues[0]?.message;
  return isErrorCode(message) ? message : "request.invalid";
}
