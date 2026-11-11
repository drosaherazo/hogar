import { createHash, randomBytes } from "node:crypto";
import { accessTokenClaimsSchema, type AccessTokenClaims } from "@hogar/shared";
import { jwtVerify, SignJWT } from "jose";

const ISSUER = "hogar-api";
const AUDIENCE = "hogar-web";
const ALGORITHM = "HS256";

export interface AccessTokenSigner {
  sign(claims: AccessTokenClaims): Promise<string>;
  /** Resolves with the claims, or `null` when the token is invalid, expired or tampered with. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export function createAccessTokenSigner(secret: string, ttlSeconds: number): AccessTokenSigner {
  const key = new TextEncoder().encode(secret);
  return {
    async sign({ sub, ...claims }) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(sub)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: ISSUER,
          audience: AUDIENCE,
          algorithms: [ALGORITHM],
        });
        const parsed = accessTokenClaimsSchema.safeParse(payload);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * A new opaque secret (refresh tokens, invitation tokens): 32 random bytes, URL-safe.
 * Only its hash is ever stored.
 */
export function generateSecretToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 is enough here: 256 bits of entropy can't be brute-forced, unlike a password. */
export function hashSecretToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
