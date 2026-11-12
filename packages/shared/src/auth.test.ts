import { describe, expect, it } from "vitest";
import {
  authResponseSchema,
  claimsFromUser,
  emailCodeRequestSchema,
  emailSignInRequestSchema,
  googleLoginRequestSchema,
  userFromClaims,
  type AuthUser,
} from "./auth";
import { apiErrorSchema, errorCodeFrom } from "./errors";

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

describe("emailCodeRequestSchema", () => {
  it("trims and lower-cases the address, keeping + addresses as typed", () => {
    expect(emailCodeRequestSchema.parse({ email: "  Ana+Hogar@Example.COM ", locale: "es" })).toEqual({
      email: "ana+hogar@example.com",
      locale: "es",
    });
  });

  it.each(["", "ana", "ana@", "@example.com", "ana @example.com"])("rejects %j as auth.email.invalid", (email) => {
    const result = emailCodeRequestSchema.safeParse({ email, locale: "en" });
    expect(errorCodeFrom(result.error)).toBe("auth.email.invalid");
  });

  it("requires a supported locale", () => {
    expect(emailCodeRequestSchema.safeParse({ email: "ana@example.com", locale: "fr" }).success).toBe(false);
  });
});

describe("emailSignInRequestSchema", () => {
  it.each(["482913", "482 913", " 482-913 ", "48 29 13"])("accepts %j as 482913", (code) => {
    expect(emailSignInRequestSchema.parse({ email: "ana@example.com", code }).code).toBe("482913");
  });

  it("keeps leading zeros", () => {
    expect(emailSignInRequestSchema.parse({ email: "ana@example.com", code: "000123" }).code).toBe("000123");
  });

  it.each(["", "48291", "4829134", "abcdef"])("rejects %j as auth.code.format", (code) => {
    const result = emailSignInRequestSchema.safeParse({ email: "ana@example.com", code });
    expect(errorCodeFrom(result.error)).toBe("auth.code.format");
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
