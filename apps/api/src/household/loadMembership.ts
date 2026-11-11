import { canEditContent, canManageHousehold } from "@hogar/shared";
import type { RequestHandler } from "express";
import type { Database } from "../db";
import type { Membership } from "../generated/prisma/client";
import { forbidden, notFound, unauthorized } from "../httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express exposes request augmentation through this global namespace.
  namespace Express {
    interface Request {
      /** Set by `loadMembership`: the caller's place in their household, read fresh from the database. */
      membership?: Membership;
    }
  }
}

/**
 * Resolves the caller's household from their own membership. No household id ever comes
 * from the client, so nobody can act on a household they don't belong to.
 * Roles are read on every request because admins can change them at any time.
 */
export function loadMembership(db: Database): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) throw unauthorized("auth.token.invalid");
    const membership = await db.membership.findUnique({ where: { userId: req.auth.sub } });
    if (!membership) throw notFound("household.not_member");
    req.membership = membership;
    next();
  };
}

/** Only admins get through. Must run after `loadMembership`. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.membership || !canManageHousehold(req.membership.role)) throw forbidden("household.forbidden");
  next();
};

/**
 * Admins and members get through; guests only read, so they get a message written for them
 * rather than the admin-only one. Must run after `loadMembership`.
 */
export const requireEditor: RequestHandler = (req, _res, next) => {
  if (!req.membership || !canEditContent(req.membership.role)) throw forbidden("household.read_only");
  next();
};

/** The membership `loadMembership` attached; throws if the middleware wasn't mounted. */
export function membershipOf(req: Express.Request): Membership {
  if (!req.membership) throw new Error("loadMembership must run before this handler");
  return req.membership;
}
