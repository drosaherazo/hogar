import {
  changeRoleRequestSchema,
  createHouseholdRequestSchema,
  errorCodeFrom,
  renameHouseholdRequestSchema,
  type CurrentHousehold,
  type HouseholdResponse,
} from "@hogar/shared";
import { Router, type Request } from "express";
import type { z } from "zod";
import type { Database } from "../db";
import { badRequest, unauthorized } from "../httpError";
import type { HouseholdService } from "./householdService";
import { loadMembership, membershipOf, requireAdmin } from "./loadMembership";

/** Validates a body with a shared schema; the first failed check becomes the error code. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(errorCodeFrom(parsed.error));
  return parsed.data;
}

export function userIdOf(req: Request): string {
  if (!req.auth) throw unauthorized("auth.token.invalid");
  return req.auth.sub;
}

/** `/api/household`: the caller's own household, resolved on the server. */
export function createHouseholdRouter(db: Database, households: HouseholdService) {
  const router = Router();
  const member = loadMembership(db);

  router.get("/", async (req, res) => {
    const body: CurrentHousehold = await households.getCurrent(userIdOf(req));
    res.json(body);
  });

  router.post("/", async (req, res) => {
    const { name } = parseBody(createHouseholdRequestSchema, req.body);
    const body: HouseholdResponse = { household: await households.create(userIdOf(req), name) };
    res.status(201).json(body);
  });

  router.patch("/", member, requireAdmin, async (req, res) => {
    const { name } = parseBody(renameHouseholdRequestSchema, req.body);
    const body: HouseholdResponse = {
      household: await households.rename(membershipOf(req).householdId, userIdOf(req), name),
    };
    res.json(body);
  });

  router.post("/leave", member, async (req, res) => {
    await households.leave(membershipOf(req));
    res.status(204).end();
  });

  router.patch("/members/:membershipId", member, requireAdmin, async (req, res) => {
    const { role } = parseBody(changeRoleRequestSchema, req.body);
    const body: HouseholdResponse = {
      household: await households.changeRole(membershipOf(req), String(req.params["membershipId"]), role),
    };
    res.json(body);
  });

  router.delete("/members/:membershipId", member, requireAdmin, async (req, res) => {
    const body: HouseholdResponse = {
      household: await households.removeMember(membershipOf(req), String(req.params["membershipId"])),
    };
    res.json(body);
  });

  return router;
}
