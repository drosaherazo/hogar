import { Router } from "express";
import type { AuthService } from "../auth/authService";
import { unauthorized } from "../httpError";

export function createMeRouter(auth: AuthService) {
  const router = Router();

  /** The signed-in user, fresh from the database. */
  router.get("/", async (req, res) => {
    // A valid token for a user that no longer exists is as good as no token.
    const user = req.auth ? await auth.getUser(req.auth.sub) : null;
    if (!user) throw unauthorized("auth.token.invalid");
    res.json(user);
  });

  return router;
}
