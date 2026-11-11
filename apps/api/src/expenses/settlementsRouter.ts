import { settlementInputSchema, updateSettlementInputSchema, type SettlementResponse } from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { parseBody } from "../household/householdRouter";
import { loadMembership, membershipOf, requireEditor } from "../household/loadMembership";
import { versionOf } from "./expensesRouter";
import type { SettlementService } from "./settlementService";

/** `/api/household/settlements` (payments): everyone in the household reads; admins and members write. */
export function createSettlementsRouter(db: Database, settlements: SettlementService) {
  const router = Router();
  router.use(loadMembership(db));

  router.get("/:id", async (req, res) => {
    const body: SettlementResponse = {
      settlement: await settlements.get(membershipOf(req).householdId, String(req.params["id"])),
    };
    res.json(body);
  });

  router.post("/", requireEditor, async (req, res) => {
    const input = parseBody(settlementInputSchema, req.body);
    const body: SettlementResponse = { settlement: await settlements.create(membershipOf(req), input) };
    res.status(201).json(body);
  });

  router.put("/:id", requireEditor, async (req, res) => {
    const input = parseBody(updateSettlementInputSchema, req.body);
    const body: SettlementResponse = {
      settlement: await settlements.update(membershipOf(req), String(req.params["id"]), input),
    };
    res.json(body);
  });

  router.delete("/:id", requireEditor, async (req, res) => {
    await settlements.remove(membershipOf(req), String(req.params["id"]), versionOf(req));
    res.status(204).end();
  });

  return router;
}
