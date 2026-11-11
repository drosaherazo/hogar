import {
  createInvitationRequestSchema,
  invitationTokenRequestSchema,
  type CreatedInvitation,
  type HouseholdResponse,
  type InvitationList,
  type InvitationPreview,
} from "@hogar/shared";
import { Router, type RequestHandler } from "express";
import type { Database } from "../db";
import { parseBody, userIdOf } from "./householdRouter";
import type { InvitationService } from "./invitationService";
import { loadMembership, membershipOf, requireAdmin } from "./loadMembership";

/** `/api/household/invitations`: admins create, list, renew and revoke their household's links. */
export function createHouseholdInvitationsRouter(db: Database, invitations: InvitationService) {
  const router = Router();
  router.use(loadMembership(db), requireAdmin);

  router.get("/", async (req, res) => {
    const body: InvitationList = { invitations: await invitations.list(membershipOf(req).householdId) };
    res.json(body);
  });

  router.post("/", async (req, res) => {
    const { role } = parseBody(createInvitationRequestSchema, req.body);
    const body: CreatedInvitation = await invitations.create(membershipOf(req), role);
    // The token is a secret: keep it out of any cache.
    res.status(201).set("Cache-Control", "no-store").json(body);
  });

  router.post("/:id/renew", async (req, res) => {
    const body: CreatedInvitation = await invitations.renew(membershipOf(req), String(req.params["id"]));
    res.status(201).set("Cache-Control", "no-store").json(body);
  });

  router.delete("/:id", async (req, res) => {
    await invitations.revoke(membershipOf(req).householdId, String(req.params["id"]));
    res.status(204).end();
  });

  return router;
}

/**
 * `/api/invitations`: the invitee's side. Tokens come in the body, never in the URL,
 * so they don't end up in access logs. Rate limited because tokens are guessable only by brute force.
 */
export function createInvitationsRouter(invitations: InvitationService, rateLimit: RequestHandler) {
  const router = Router();
  router.use(rateLimit);

  router.post("/lookup", async (req, res) => {
    const { token } = parseBody(invitationTokenRequestSchema, req.body);
    const body: InvitationPreview = await invitations.lookup(token, userIdOf(req));
    res.json(body);
  });

  router.post("/accept", async (req, res) => {
    const { token } = parseBody(invitationTokenRequestSchema, req.body);
    const body: HouseholdResponse = { household: await invitations.accept(token, userIdOf(req)) };
    res.json(body);
  });

  return router;
}
