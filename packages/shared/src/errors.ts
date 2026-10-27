import { z } from "zod";

/**
 * Error codes the API returns instead of user-facing sentences.
 * The web translates each one (`errors` namespace), so every code needs an `en` and `es` message.
 */
export const ERROR_CODES = [
  "auth.google.invalid_token",
  "auth.google.email_not_verified",
  "auth.session.missing",
  "auth.session.expired",
  "auth.session.reused",
  "auth.token.invalid",
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
