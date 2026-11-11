import { activityQuerySchema, type ActivityPage } from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { badRequest } from "../httpError";
import { loadMembership, membershipOf } from "../household/loadMembership";
import type { LedgerService } from "./ledgerService";

/**
 * `/api/household/activity` (and later `/balances`). It is mounted on `/api/household`, so the
 * membership check is attached per route: a router-level `use` would also run for the household
 * routes, including `GET /api/household` for people without one.
 */
export function createLedgerRouter(db: Database, ledger: LedgerService) {
  const router = Router();
  const member = loadMembership(db);

  router.get("/activity", member, async (req, res) => {
    const query = activityQuerySchema.safeParse(req.query);
    if (!query.success) throw badRequest("request.invalid");
    const membership = membershipOf(req);
    const body: ActivityPage = await ledger.activity(membership.householdId, membership.userId, query.data);
    res.json(body);
  });

  return router;
}
