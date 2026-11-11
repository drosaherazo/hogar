import { canEditContent, type PersonRef, type Role } from "@hogar/shared";
import type { Database } from "../db";
import type { Membership, Prisma } from "../generated/prisma/client";
import { MEMBER_ORDER } from "../household/householdView";
import { forbidden } from "../httpError";

/** Works both inside and outside a transaction. */
export type Client = Prisma.TransactionClient | Database;

export interface CurrentMember {
  membershipId: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  weight: number;
}

/** The household's members in member order (who joined first): the order leftover cents follow. */
export async function currentMembers(client: Client, householdId: string): Promise<CurrentMember[]> {
  const rows = await client.membership.findMany({
    where: { householdId },
    orderBy: MEMBER_ORDER,
    include: { user: { select: { name: true, avatarUrl: true } } },
  });
  return rows.map((row) => ({
    membershipId: row.id,
    userId: row.userId,
    name: row.user.name,
    avatarUrl: row.user.avatarUrl,
    role: row.role,
    weight: row.weight,
  }));
}

/**
 * The actor's role may have changed since the request's own check (an admin can demote people
 * at any time), so it is checked again against the members read under the household lock.
 */
export function assertStillEditor(members: readonly CurrentMember[], actor: Membership): void {
  const current = members.find((member) => member.userId === actor.userId);
  if (!current || !canEditContent(current.role)) throw forbidden("household.read_only");
}

/**
 * Whether someone appears in the household's live expenses or payments. Former members who do
 * can still pay or be paid; deleted records keep showing names but don't count.
 */
export async function isInHistory(client: Client, householdId: string, userId: string): Promise<boolean> {
  const live = { householdId, deletedAt: null };
  const [paid, shared, settled] = await Promise.all([
    client.expense.count({ where: { ...live, paidById: userId } }),
    client.expenseShare.count({ where: { userId, expense: live } }),
    client.settlement.count({ where: { ...live, OR: [{ fromUserId: userId }, { toUserId: userId }] } }),
  ]);
  return paid + shared + settled > 0;
}

/** Name, avatar and "former member" flag for each user id, as the household sees them now. */
export async function personRefs(
  client: Client,
  members: readonly CurrentMember[],
  userIds: Iterable<string>,
): Promise<Map<string, PersonRef>> {
  const current = new Set(members.map((member) => member.userId));
  const users = await client.user.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, name: true, avatarUrl: true },
  });
  return new Map(
    users.map((user) => [
      user.id,
      { userId: user.id, name: user.name, avatarUrl: user.avatarUrl, former: !current.has(user.id) },
    ]),
  );
}

/** The reference for one user; every id the services ask for was loaded, so a miss is a bug. */
export function refOf(refs: ReadonlyMap<string, PersonRef>, userId: string): PersonRef {
  const ref = refs.get(userId);
  if (!ref) throw new Error(`No person reference loaded for user ${userId}`);
  return ref;
}

/**
 * Current members first, in member order; then former members by name and id. Plain code-point
 * comparison keeps the order identical on every server, whatever its locale.
 */
export function orderPeople<T>(
  items: readonly T[],
  personOf: (item: T) => PersonRef,
  members: readonly CurrentMember[],
) {
  const position = new Map(members.map((member, index) => [member.userId, index]));
  const rank = (person: PersonRef) => position.get(person.userId) ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => {
    const first = personOf(a);
    const second = personOf(b);
    const byMember = rank(first) - rank(second);
    if (byMember !== 0) return byMember;
    if (first.name !== second.name) return first.name < second.name ? -1 : 1;
    return first.userId < second.userId ? -1 : first.userId > second.userId ? 1 : 0;
  });
}
