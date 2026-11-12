import { randomUUID } from "node:crypto";
import {
  claimsFromUser,
  normalizeEmail,
  pickStarterName,
  resolveLocale,
  type AuthResponse,
  type AuthUser,
  type Locale,
} from "@hogar/shared";
import type { Database } from "../db";
import type { Mailer } from "../email/mailer";
import { renderSignInCodeEmail } from "../email/signInCodeEmail";
import type { User } from "../generated/prisma/client";
import { isUniqueViolation } from "../household/householdService";
import { conflict, serviceUnavailable, unauthorized } from "../httpError";
import type { GoogleIdentity, GoogleVerifier } from "./googleVerifier";
import { createSignInCodes } from "./signInCodes";
import { generateSecretToken, hashSecretToken, type AccessTokenSigner } from "./tokens";

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
  mailer: Mailer;
  /** HMAC key for sign-in codes. */
  codeSecret: string;
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

/** Runs `create` again once if it lost a race on a unique column; the second run finds the winner's row. */
async function retryOnceOnUniqueViolation<T>(create: () => Promise<T>): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return create();
  }
}

export function createAuthService({
  db,
  google,
  mailer,
  codeSecret,
  signer,
  refreshTokenTtlDays,
  now = () => new Date(),
}: AuthServiceDeps) {
  const codes = createSignInCodes({ db, secret: codeSecret, now });

  async function issueSession(user: User, familyId: string): Promise<Session> {
    const refreshToken = generateSecretToken();
    const refreshTokenExpiresAt = new Date(now().getTime() + refreshTokenTtlDays * DAY_MS);
    await db.refreshToken.create({
      data: { userId: user.id, tokenHash: hashSecretToken(refreshToken), familyId, expiresAt: refreshTokenExpiresAt },
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

  /**
   * One person per email address (ADR 0008): look the person up by Google `sub`, then by the
   * verified email. At most one Google account is linked; a second one is refused, never swapped.
   */
  async function findOrCreateGoogleUser(identity: GoogleIdentity, acceptLanguage: string | undefined) {
    const linked = await db.user.findUnique({ where: { googleId: identity.googleId } });
    if (linked) return db.user.update({ where: { id: linked.id }, data: { avatarUrl: identity.avatarUrl } });

    const email = normalizeEmail(identity.email);
    const sameEmail = await db.user.findUnique({ where: { email } });
    if (sameEmail) {
      // Linking only succeeds while no Google account is linked, so two racing accounts can't both win.
      const { count } = await db.user.updateMany({
        where: { id: sameEmail.id, googleId: null },
        data: { googleId: identity.googleId, avatarUrl: identity.avatarUrl },
      });
      if (count === 0) throw conflict("auth.google.already_linked");
      return db.user.findUniqueOrThrow({ where: { id: sameEmail.id } });
    }

    // The locale is only guessed on sign-up; afterwards it's the person's own choice.
    const locale = resolveLocale(identity.locale ?? acceptLanguage);
    return db.user.create({
      data: {
        googleId: identity.googleId,
        email,
        name: identity.name ?? pickStarterName(locale),
        avatarUrl: identity.avatarUrl,
        locale,
      },
    });
  }

  return {
    /**
     * Verifies the Google ID token, creates the person on first sign-in and starts a new session.
     * Google names a person only once (ADR 0008): later sign-ins refresh only the photo.
     */
    async loginWithGoogle(credential: string, acceptLanguage: string | undefined): Promise<Session> {
      const identity = await google.verify(credential);
      if (!identity) throw unauthorized("auth.google.invalid_token");
      if (!identity.emailVerified) throw unauthorized("auth.google.email_not_verified");

      // A simultaneous first sign-in can win the race to create the row; the retry then finds it.
      const user = await retryOnceOnUniqueViolation(() => findOrCreateGoogleUser(identity, acceptLanguage));
      return issueSession(user, randomUUID());
    },

    /**
     * Emails a new sign-in code to `email` (already normalized). It behaves the same whether or
     * not someone uses that address, so nobody can find out who uses Hogar. The email is in the
     * person's own language, or the login page's for a new address.
     */
    async requestEmailCode(email: string, locale: Locale): Promise<void> {
      const { id, code } = await codes.issue(email, locale);
      const person = await db.user.findUnique({ where: { email }, select: { locale: true } });
      try {
        await mailer.send({
          to: email,
          ...renderSignInCodeEmail(code, person ? resolveLocale(person.locale) : locale),
        });
      } catch (error) {
        console.error("Sign-in code email failed", error);
        await codes.discard(id);
        throw serviceUnavailable("auth.email.send_failed");
      }
    },

    /**
     * Signs in with a sign-in code. A code for an address nobody uses yet creates the person,
     * with a starter name and the language the code was asked for in.
     */
    async signInWithEmailCode(email: string, code: string): Promise<Session> {
      const { locale: codeLocale } = await codes.consume(email, code);
      const user = await retryOnceOnUniqueViolation(async () => {
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) return existing;
        const locale = resolveLocale(codeLocale);
        return db.user.create({ data: { email, name: pickStarterName(locale), locale } });
      });
      return issueSession(user, randomUUID());
    },

    /** Rotates the refresh token: the old one is revoked and a new one is issued in the same family. */
    async refresh(refreshToken: string | undefined): Promise<Session> {
      if (!refreshToken) throw unauthorized("auth.session.missing");
      const stored = await db.refreshToken.findUnique({
        where: { tokenHash: hashSecretToken(refreshToken) },
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
        where: { tokenHash: hashSecretToken(session.refreshToken) },
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
      const stored = await db.refreshToken.findUnique({ where: { tokenHash: hashSecretToken(refreshToken) } });
      if (stored) await revokeFamily(stored.familyId);
    },

    async getUser(id: string): Promise<AuthUser | null> {
      const user = await db.user.findUnique({ where: { id } });
      return user ? toAuthUser(user) : null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
