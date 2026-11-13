import type { RequestHandler } from "express";
import { forbidden } from "../httpError";

/**
 * Cookie-authenticated endpoints only accept requests whose `Origin` is our web app.
 * Together with `SameSite=Lax` on the refresh cookie, this blocks cross-site request forgery.
 */
export function requireSameOrigin(isAllowedOrigin: (origin: string | undefined) => boolean): RequestHandler {
  return (req, _res, next) => {
    if (!isAllowedOrigin(req.get("origin"))) throw forbidden("request.forbidden_origin");
    next();
  };
}
