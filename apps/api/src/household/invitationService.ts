import {
  defaultWeightFor,
  INVITATION_TTL_HOURS,
  MAX_PENDING_INVITATIONS,
  type CreatedInvitation,
  type HouseholdView,
  type InvitableRole,
  type InvitationPreview,
  type InvitationView,
} from "@hogar/shared";
import { generateSecretToken, hashSecretToken } from "../auth/tokens";
import type { Database } from "../db";
import type { Invitation, Membership, Prisma } from "../generated/prisma/client";
import { conflict, gone, notFound } from "../httpError";
import type { HouseholdService } from "./householdService";
import { isUniqueViolation } from "./householdService";

const HOUR_MS = 60 * 60 * 1000;

export interface InvitationServiceDeps {
  db: Database;
  households: HouseholdService;
  now?: (() => Date) | undefined;
}

type Transaction = Prisma.TransactionClient;
type InvitationWithCreator = Invitation & { createdBy: { name: string } | null };

export function createInvitationService({ db, households, now = () => new Date() }: InvitationServiceDeps) {
  const pendingWhere = (householdId: string): Prisma.InvitationWhereInput => ({
    householdId,
    usedAt: null,
    revokedAt: null,
    expiresAt: { gt: now() },
  });

  function toView(invitation: InvitationWithCreator): InvitationView {
    return {
      id: invitation.id,
      role: invitation.role === "GUEST" ? "GUEST" : "MEMBER",
      createdByName: invitation.createdBy?.name ?? null,
      expiresAt: invitation.expiresAt.toISOString(),
      status: invitation.expiresAt > now() ? "pending" : "expired",
    };
  }

  /** Creates a fresh link. The token is returned here and never again: only its hash is stored. */
  async function issue(tx: Transaction, membership: Membership, role: InvitableRole): Promise<CreatedInvitation> {
    const pending = await tx.invitation.count({ where: pendingWhere(membership.householdId) });
    if (pending >= MAX_PENDING_INVITATIONS) throw conflict("invitation.limit_reached");

    const token = generateSecretToken();
    const createdAt = now();
    const invitation = await tx.invitation.create({
      data: {
        householdId: membership.householdId,
        role,
        tokenHash: hashSecretToken(token),
        createdById: membership.userId,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + INVITATION_TTL_HOURS * HOUR_MS),
      },
      include: { createdBy: { select: { name: true } } },
    });
    return { invitation: toView(invitation), token };
  }

  /** The invitation behind a token, as long as it can still be used. */
  async function findUsable(client: Transaction | Database, token: string) {
    const invitation = await client.invitation.findUnique({
      where: { tokenHash: hashSecretToken(token) },
      include: { household: { select: { name: true } }, createdBy: { select: { name: true } } },
    });
    if (!invitation) throw notFound("invitation.not_found");
    assertUsable(invitation);
    return invitation;
  }

  function assertUsable(invitation: Invitation) {
    if (invitation.usedAt) throw gone("invitation.used");
    if (invitation.revokedAt) throw gone("invitation.revoked");
    if (invitation.expiresAt <= now()) throw gone("invitation.expired");
  }

  return {
    create(membership: Membership, role: InvitableRole): Promise<CreatedInvitation> {
      return db.$transaction((tx) => issue(tx, membership, role));
    },

    /** Pending and expired invitations (expired ones can be renewed); used and revoked ones are history. */
    async list(householdId: string): Promise<InvitationView[]> {
      const invitations = await db.invitation.findMany({
        where: { householdId, usedAt: null, revokedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { createdBy: { select: { name: true } } },
      });
      return invitations.map(toView);
    },

    /** Replaces a lost or expired link: the old one stops working, the new one keeps the role. */
    renew(membership: Membership, invitationId: string): Promise<CreatedInvitation> {
      return db.$transaction(async (tx) => {
        const revoked = await tx.invitation.updateManyAndReturn({
          where: { id: invitationId, householdId: membership.householdId, usedAt: null, revokedAt: null },
          data: { revokedAt: now() },
        });
        const old = revoked[0];
        if (!old) throw notFound("invitation.not_found");
        return issue(tx, membership, old.role === "GUEST" ? "GUEST" : "MEMBER");
      });
    },

    async revoke(householdId: string, invitationId: string): Promise<void> {
      const { count } = await db.invitation.updateMany({
        where: { id: invitationId, householdId, usedAt: null, revokedAt: null },
        data: { revokedAt: now() },
      });
      if (count === 0) throw notFound("invitation.not_found");
    },

    async lookup(token: string, userId: string): Promise<InvitationPreview> {
      const invitation = await findUsable(db, token);
      const membership = await db.membership.findUnique({ where: { userId } });
      return {
        householdName: invitation.household.name,
        inviterName: invitation.createdBy?.name ?? null,
        role: invitation.role === "GUEST" ? "GUEST" : "MEMBER",
        expiresAt: invitation.expiresAt.toISOString(),
        viewer: !membership
          ? "can_join"
          : membership.householdId === invitation.householdId
            ? "already_member"
            : "has_other_household",
      };
    },

    /**
     * Joins the household behind the token. Marking the invitation used is a conditional
     * update, so when two people accept the same link at once Postgres lets only one through.
     */
    async accept(token: string, userId: string): Promise<HouseholdView> {
      try {
        const householdId = await db.$transaction(async (tx) => {
          const invitation = await findUsable(tx, token);
          // Someone who already has a household can't join: the invitation stays usable for others.
          if (await tx.membership.findUnique({ where: { userId } })) throw conflict("household.already_member");

          const { count } = await tx.invitation.updateMany({
            where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: now() } },
            data: { usedAt: now(), usedById: userId },
          });
          if (count === 0) {
            // Someone else got there first (or it was revoked meanwhile): say exactly what happened.
            assertUsable(await tx.invitation.findUniqueOrThrow({ where: { id: invitation.id } }));
            throw gone("invitation.used");
          }

          await tx.membership.create({
            data: {
              householdId: invitation.householdId,
              userId,
              role: invitation.role,
              weight: defaultWeightFor(invitation.role),
              joinedAt: now(),
            },
          });
          await tx.household.update({ where: { id: invitation.householdId }, data: { membersChangedAt: now() } });
          return invitation.householdId;
        });
        return await households.view(householdId, userId);
      } catch (error) {
        if (isUniqueViolation(error)) throw conflict("household.already_member");
        throw error;
      }
    },
  };
}

export type InvitationService = ReturnType<typeof createInvitationService>;
