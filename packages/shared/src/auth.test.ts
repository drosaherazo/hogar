import { describe, expect, it } from "vitest";
import { authResponseSchema, claimsFromUser, googleLoginRequestSchema, userFromClaims, type AuthUser } from "./auth";
import { apiErrorSchema } from "./errors";

const user: AuthUser = {
  id: "user_1",
  email: "ana@example.com",
  name: "Ana García",
  avatarUrl: "https://lh3.googleusercontent.com/a/photo",
  locale: "es",
};

describe("googleLoginRequestSchema", () => {
  it("requires a non-empty credential", () => {
    expect(googleLoginRequestSchema.safeParse({ credential: "token" }).success).toBe(true);
    expect(googleLoginRequestSchema.safeParse({ credential: "" }).success).toBe(false);
    expect(googleLoginRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("authResponseSchema", () => {
  it("accepts a token with a valid user, including users without a photo", () => {
    expect(authResponseSchema.safeParse({ accessToken: "jwt", user }).success).toBe(true);
    expect(authResponseSchema.safeParse({ accessToken: "jwt", user: { ...user, avatarUrl: null } }).success).toBe(true);
  });

  it("rejects unsupported locales and invalid emails", () => {
    expect(authResponseSchema.safeParse({ accessToken: "jwt", user: { ...user, locale: "fr" } }).success).toBe(false);
    expect(authResponseSchema.safeParse({ accessToken: "jwt", user: { ...user, email: "nope" } }).success).toBe(false);
  });
});

describe("claims", () => {
  it("round-trips a user through token claims", () => {
    expect(userFromClaims(claimsFromUser(user))).toEqual(user);
  });
});

describe("apiErrorSchema", () => {
  it("only accepts known error codes", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "auth.token.invalid" } }).success).toBe(true);
    expect(apiErrorSchema.safeParse({ error: { code: "Something went wrong" } }).success).toBe(false);
  });
});
