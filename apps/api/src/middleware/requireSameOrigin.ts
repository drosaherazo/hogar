import type { RequestHandler } from "express";
import { forbidden } from "../httpError";
import type { OriginMatcher } from "../auth/originMatcher";

/**
 * Cookie-authenticated endpoints only accept requests whose `Origin` is our web app.
 * Together with `SameSite=Lax` on the refresh cookie, this blocks cross-site request forgery.
 */
export function requireSameOrigin(isAllowedOrigin: OriginMatcher): RequestHandler {
  return (req, _res, next) => {
    if (!isAllowedOrigin(req.get("origin"))) throw forbidden("request.forbidden_origin");
    next();
  };
}
