import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SIGN_IN_CODE_LENGTH, type Locale } from "@hogar/shared";
import type { Database } from "../db";
import { SIGN_IN_CODE_MINUTES } from "../email/signInCodeEmail";
import { tooManyRequests, unauthorized } from "../httpError";

/** The sign-in code rules of ADR 0008. */
const CODE_TTL_MS = SIGN_IN_CODE_MINUTES * 60 * 1000;
const MAX_ATTEMPTS = 5;
const GAP_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const PER_HOUR = 5;
const DAY_MS = 24 * HOUR_MS;
const PER_DAY = 10;

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));

export interface SignInCodesDeps {
  db: Database;
  /** HMAC key (`EMAIL_CODE_SECRET`). */
  secret: string;
  now: () => Date;
}

/**
 * Issues and checks sign-in codes. Codes are 6 random digits, stored only as an HMAC keyed with
 * the server secret (a plain hash of a million values is reversed instantly). Every rule is
 * enforced here, on the server: expiry, single use, attempts, replacement and rate limits.
 * Only the newest code for an address is live, so a newer code replaces the older ones just by
 * existing. `email` is always already normalized.
 */
export function createSignInCodes({ db, secret, now }: SignInCodesDeps) {
  // The address is part of the message, so equal codes for different people never hash alike.
  const hash = (email: string, code: string) => createHmac("sha256", secret).update(`${email}\n${code}`).digest();

  return {
    /**
     * Creates a new code for `email`, or refuses with
     * `auth.code.too_soon` (with `Retry-After`) or `auth.code.daily_limit`.
     */
    async issue(email: string, locale: Locale): Promise<{ id: string; code: string }> {
      const code = String(randomInt(0, 10 ** SIGN_IN_CODE_LENGTH)).padStart(SIGN_IN_CODE_LENGTH, "0");
      const at = now();

      return db.$transaction(async (tx) => {
        // One request per address at a time, so racing requests can't both pass the limits and
        // only the newest code stays valid.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
        await tx.signInCode.deleteMany({ where: { createdAt: { lte: new Date(at.getTime() - DAY_MS) } } });

        const recent = await tx.signInCode.findMany({
          where: { email },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        if (recent.length >= PER_DAY) throw tooManyRequests("auth.code.daily_limit");
        const last = recent.at(-1);
        if (last && at.getTime() - last.createdAt.getTime() < GAP_MS) {
          throw tooManyRequests("auth.code.too_soon", seconds(last.createdAt.getTime() + GAP_MS - at.getTime()));
        }
        const thisHour = recent.filter((row) => at.getTime() - row.createdAt.getTime() < HOUR_MS);
        const oldestThisHour = thisHour[0];
        if (thisHour.length >= PER_HOUR && oldestThisHour) {
          throw tooManyRequests(
            "auth.code.too_soon",
            seconds(oldestThisHour.createdAt.getTime() + HOUR_MS - at.getTime()),
          );
        }

        const row = await tx.signInCode.create({
          data: {
            email,
            codeHash: hash(email, code).toString("hex"),
            locale,
            expiresAt: new Date(at.getTime() + CODE_TTL_MS),
            createdAt: at,
          },
          select: { id: true },
        });
        return { id: row.id, code };
      });
    },

    /**
     * Forgets a code whose email could not be sent, so it doesn't count against the limits and the
     * code already in the person's inbox, if any, is the newest again and keeps working.
     */
    async discard(id: string): Promise<void> {
      await db.signInCode.deleteMany({ where: { id } });
    },

    /**
     * Uses up the live code for `email` if `code` matches, returning the language it was asked
     * for in. Fails with `auth.code.wrong` while attempts are left, and `auth.code.expired` for
     * every other case (expired, used, replaced, out of attempts, or never sent), so the answer
     * says nothing about the address.
     */
    async consume(email: string, code: string): Promise<{ locale: string }> {
      const at = now();
      // Each check reserves one attempt before comparing, atomically, so parallel guesses can
      // never get more than MAX_ATTEMPTS tries between them.
      // Every check counts, even one with an older code that no longer works: the cap is on tries,
      // whatever was typed.
      const [reserved] = await db.$queryRaw<{ id: string; code_hash: string; attempts: number; locale: string }[]>`
        UPDATE "sign_in_codes" SET "attempts" = "attempts" + 1
        WHERE "id" = (
          SELECT "id" FROM "sign_in_codes"
          WHERE "email" = ${email}
          ORDER BY "created_at" DESC LIMIT 1
        )
        AND "attempts" < ${MAX_ATTEMPTS} AND "expires_at" > ${at} AND "used_at" IS NULL
        RETURNING "id", "code_hash", "attempts", "locale"`;
      if (!reserved) throw unauthorized("auth.code.expired");

      const typed = hash(email, code);
      const matches = (codeHash: string) => timingSafeEqual(typed, Buffer.from(codeHash, "hex"));
      if (!matches(reserved.code_hash)) {
        // An earlier code that a newer one replaced isn't a typo: tell the person it no longer works.
        const earlier = await db.signInCode.findMany({
          where: { email, id: { not: reserved.id } },
          select: { codeHash: true },
        });
        const isOldCode = earlier.some((row) => matches(row.codeHash));
        throw unauthorized(!isOldCode && reserved.attempts < MAX_ATTEMPTS ? "auth.code.wrong" : "auth.code.expired");
      }
      const { count } = await db.signInCode.updateMany({
        where: { id: reserved.id, usedAt: null },
        data: { usedAt: at },
      });
      if (count === 0) throw unauthorized("auth.code.expired");
      return { locale: reserved.locale };
    },
  };
}

export type SignInCodes = ReturnType<typeof createSignInCodes>;
