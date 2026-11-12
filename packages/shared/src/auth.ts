import { z } from "zod";
import type { ErrorCode } from "./errors";
import { localeSchema } from "./locale";

/**
 * One person per email address (ADR 0008): addresses are compared, and stored, trimmed and
 * lower-cased. `+` addresses and dots are kept as typed; there are no provider-specific rules.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Zod messages are error codes the web translates, never sentences. */
const code = (value: ErrorCode) => value;

/** Longest address SMTP allows. */
const EMAIL_MAX = 254;

/** An email address as people type it: trimmed and lower-cased before it is checked. */
export const emailAddressSchema = z
  .string(code("auth.email.invalid"))
  .transform(normalizeEmail)
  .pipe(z.email(code("auth.email.invalid")).max(EMAIL_MAX, code("auth.email.invalid")));

/** How many digits a sign-in code has. */
export const SIGN_IN_CODE_LENGTH = 6;

/** A sign-in code as people type or paste it ("482 913"): only the digits count. */
export const signInCodeSchema = z
  .string(code("auth.code.format"))
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().length(SIGN_IN_CODE_LENGTH, code("auth.code.format")));

/** Body of `POST /api/auth/email/code`: where to send a code, and the login page's language. */
export const emailCodeRequestSchema = z.object({
  email: emailAddressSchema,
  locale: localeSchema,
});
export type EmailCodeRequest = z.input<typeof emailCodeRequestSchema>;

/** Body of `POST /api/auth/email/sign-in`. */
export const emailSignInRequestSchema = z.object({
  email: emailAddressSchema,
  code: signInCodeSchema,
});
export type EmailSignInRequest = z.input<typeof emailSignInRequestSchema>;

/** Body of `POST /api/auth/google`: the ID token Google Identity Services hands to the browser. */
export const googleLoginRequestSchema = z.object({
  credential: z.string().min(1),
});
export type GoogleLoginRequest = z.infer<typeof googleLoginRequestSchema>;

/** Basic user data the API shares with the web. */
export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  avatarUrl: z.url().nullable(),
  locale: localeSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Response of login and refresh: a short-lived access token plus the user it belongs to. */
export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Claims inside our access token (JWT). `sub` is the user id. */
export const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  picture: z.url().nullable(),
  locale: localeSchema,
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export function claimsFromUser(user: AuthUser): AccessTokenClaims {
  return { sub: user.id, email: user.email, name: user.name, picture: user.avatarUrl, locale: user.locale };
}

export function userFromClaims(claims: AccessTokenClaims): AuthUser {
  return { id: claims.sub, email: claims.email, name: claims.name, avatarUrl: claims.picture, locale: claims.locale };
}
