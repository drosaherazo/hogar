import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createAccessTokenSigner, generateRefreshToken, hashRefreshToken } from "./tokens";

const secret = "test-secret-that-is-long-enough-for-hs256-signing";
const claims = {
  sub: "user_1",
  email: "ana@example.com",
  name: "Ana García",
  picture: null,
  locale: "es" as const,
};

describe("access tokens", () => {
  it("signs and verifies the user's basic claims", async () => {
    const signer = createAccessTokenSigner(secret, 900);
    expect(await signer.verify(await signer.sign(claims))).toEqual(claims);
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await createAccessTokenSigner("another-secret-that-is-also-long-enough", 900).sign(claims);
    expect(await createAccessTokenSigner(secret, 900).verify(token)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const key = new TextEncoder().encode(secret);
    const expired = await new SignJWT({ email: claims.email, name: claims.name, picture: null, locale: "es" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("hogar-api")
      .setAudience("hogar-web")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    expect(await createAccessTokenSigner(secret, 900).verify(expired)).toBeNull();
  });

  it("rejects tokens for another audience", async () => {
    const key = new TextEncoder().encode(secret);
    const foreign = await new SignJWT({ email: claims.email, name: claims.name, picture: null, locale: "es" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("hogar-api")
      .setAudience("someone-else")
      .setExpirationTime("5m")
      .sign(key);
    expect(await createAccessTokenSigner(secret, 900).verify(foreign)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await createAccessTokenSigner(secret, 900).verify("not-a-jwt")).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("are random and URL-safe", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("are stored as a stable SHA-256 hash, never in plain text", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});
