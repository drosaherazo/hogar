import { randomUUID } from "node:crypto";
import { claimsFromUser, resolveLocale, type AuthResponse, type AuthUser } from "@hogar/shared";
import type { Database } from "../db";
import type { User } from "../generated/prisma/client";
import { unauthorized } from "../httpError";
import type { GoogleVerifier } from "./googleVerifier";
import { generateRefreshToken, hashRefreshToken, type AccessTokenSigner } from "./tokens";

/**
 * Two requests can race to rotate the same refresh token (two tabs opening at once).
 * Reuse inside this window is treated as that race, not as theft.
 */
const ROTATION_GRACE_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Session extends AuthResponse {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthServiceDeps {
  db: Database;
  google: GoogleVerifier;
  signer: AccessTokenSigner;
  refreshTokenTtlDays: number;
  now?: (() => Date) | undefined;
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    locale: resolveLocale(user.locale),
  };
}

export function createAuthService({
  db,
  google,
  signer,
  refreshTokenTtlDays,
  now = () => new Date(),
}: AuthServiceDeps) {
  async function issueSession(user: User, familyId: string): Promise<Session> {
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(now().getTime() + refreshTokenTtlDays * DAY_MS);
    await db.refreshToken.create({
      data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), familyId, expiresAt: refreshTokenExpiresAt },
    });
    const authUser = toAuthUser(user);
    return {
      accessToken: await signer.sign(claimsFromUser(authUser)),
      user: authUser,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async function revokeFamily(familyId: string) {
    await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now() } });
  }

  return {
    /** Verifies the Google ID token, creates or updates the user and starts a new session. */
    async loginWithGoogle(credential: string, acceptLanguage: string | undefined): Promise<Session> {
      const identity = await google.verify(credential);
      if (!identity) throw unauthorized("auth.google.invalid_token");
      if (!identity.emailVerified) throw unauthorized("auth.google.email_not_verified");

      const user = await db.user.upsert({
        where: { googleId: identity.googleId },
        // The locale is only guessed on sign-up; afterwards it's the person's own choice.
        create: {
          googleId: identity.googleId,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          locale: resolveLocale(identity.locale ?? acceptLanguage),
        },
        update: { email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl },
      });
      return issueSession(user, randomUUID());
    },

    /** Rotates the refresh token: the old one is revoked and a new one is issued in the same family. */
    async refresh(refreshToken: string | undefined): Promise<Session> {
      if (!refreshToken) throw unauthorized("auth.session.missing");
      const stored = await db.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        include: { user: true },
      });
      if (!stored) throw unauthorized("auth.session.missing");

      if (stored.revokedAt) {
        const isRace = now().getTime() - stored.revokedAt.getTime() < ROTATION_GRACE_MS && stored.replacedById;
        if (isRace) throw unauthorized("auth.session.missing");
        // A revoked token came back: someone may have stolen it. End the whole session.
        await revokeFamily(stored.familyId);
        throw unauthorized("auth.session.reused");
      }
      if (stored.expiresAt <= now()) throw unauthorized("auth.session.expired");

      const session = await issueSession(stored.user, stored.familyId);
      const replacement = await db.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashRefreshToken(session.refreshToken) },
        select: { id: true },
      });
      const { count } = await db.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now(), replacedById: replacement.id },
      });
      if (count === 0) {
        // Another request rotated it first; drop the token we just created.
        await db.refreshToken.update({ where: { id: replacement.id }, data: { revokedAt: now() } });
        throw unauthorized("auth.session.missing");
      }
      return session;
    },

    /** Ends the session on every device that shares this refresh token family. */
    async logout(refreshToken: string | undefined): Promise<void> {
      if (!refreshToken) return;
      const stored = await db.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(refreshToken) } });
      if (stored) await revokeFamily(stored.familyId);
    },

    async getUser(id: string): Promise<AuthUser | null> {
      const user = await db.user.findUnique({ where: { id } });
      return user ? toAuthUser(user) : null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
