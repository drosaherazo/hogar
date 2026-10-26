import type { RequestHandler } from "express";
import { forbidden } from "../httpError";

/**
 * Cookie-authenticated endpoints only accept requests whose `Origin` is our web app.
 * Together with `SameSite=Lax` on the refresh cookie, this blocks cross-site request forgery.
 */
export function requireSameOrigin(webOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (req.get("origin") !== webOrigin) throw forbidden("request.forbidden_origin");
    next();
  };
}
