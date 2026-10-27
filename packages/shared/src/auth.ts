import { z } from "zod";
import { localeSchema } from "./locale";

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
