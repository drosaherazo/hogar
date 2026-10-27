import type { AccessTokenClaims } from "@hogar/shared";
import type { RequestHandler } from "express";
import { unauthorized } from "../httpError";
import type { AccessTokenSigner } from "./tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express exposes request augmentation through this global namespace.
  namespace Express {
    interface Request {
      /** Set by `requireAuth`: the claims of a valid access token. */
      auth?: AccessTokenClaims;
    }
  }
}

/** Requires `Authorization: Bearer <access token>` and exposes its claims as `req.auth`. */
export function requireAuth(signer: AccessTokenSigner): RequestHandler {
  return async (req, _res, next) => {
    const [scheme, token] = req.get("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw unauthorized("auth.token.invalid");
    const claims = await signer.verify(token);
    if (!claims) throw unauthorized("auth.token.invalid");
    req.auth = claims;
    next();
  };
}
