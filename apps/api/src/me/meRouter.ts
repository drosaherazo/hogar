import { Router } from "express";
import type { AuthService } from "../auth/authService";
import type { HouseholdService } from "../household/householdService";
import { unauthorized } from "../httpError";

export function createMeRouter(auth: AuthService, households: HouseholdService) {
  const router = Router();

  /** The signed-in user, fresh from the database. */
  router.get("/", async (req, res) => {
    // A valid token for a user that no longer exists is as good as no token.
    const user = req.auth ? await auth.getUser(req.auth.sub) : null;
    if (!user) throw unauthorized("auth.token.invalid");
    res.json(user);
  });

  /** The web has shown the "you were removed from…" note; don't show it again. */
  router.delete("/removal-notice", async (req, res) => {
    if (!req.auth) throw unauthorized("auth.token.invalid");
    await households.dismissRemovalNotice(req.auth.sub);
    res.status(204).end();
  });

  return router;
}
