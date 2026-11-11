# Data model: Households

PostgreSQL via Prisma 7 (`apps/api/prisma/schema.prisma`). Table and column names are snake_case through `@@map`/`@map`, as in the existing models. Ids are `cuid()`.

## Enums

- **Role:** `ADMIN` | `MEMBER` | `GUEST`. Mirrored in `packages/shared` as `roleSchema`.

## Household (`households`)

| Field                 | Type          | Rules                                                        |
| --------------------- | ------------- | ------------------------------------------------------------ |
| id                    | String (cuid) | PK                                                           |
| name                  | String        | 1–50 chars after trimming (validated by the shared schema)   |
| membersChangedAt      | DateTime      | set on create, join, leave and remove                        |
| splitSavedAt          | DateTime?     | set when an ADMIN saves the split; null until the first save |
| createdAt / updatedAt | DateTime      | defaults                                                     |

Relations: `memberships` (1–n), `invitations` (1–n). Deleting a household cascades to both.

Lifecycle: created together with its first `Membership` (ADMIN, weight 1) in one transaction; deleted in the same transaction in which its last member leaves. It never exists without members.

## Membership (`memberships`)

| Field       | Type          | Rules                                                               |
| ----------- | ------------- | ------------------------------------------------------------------- |
| id          | String (cuid) | PK; the id the API uses for members                                 |
| householdId | String        | FK → Household, `onDelete: Cascade`, indexed                        |
| userId      | String        | FK → User, `onDelete: Cascade`, **unique** (one household per user) |
| role        | Role          | —                                                                   |
| weight      | Int           | 0–100, enforced by a DB `CHECK` plus the shared schema              |
| joinedAt    | DateTime      | default now; ordering key (then `id`)                               |

Defaults on creation: the creator gets `ADMIN`/1; invitees get `MEMBER`/1 or `GUEST`/0. A role change never touches `weight`.

Invariant (enforced in a transaction via `checkAdminInvariant`): a household with ≥ 1 membership has ≥ 1 `ADMIN`.

## Invitation (`invitations`)

| Field       | Type          | Rules                                                                  |
| ----------- | ------------- | ---------------------------------------------------------------------- |
| id          | String (cuid) | PK                                                                     |
| householdId | String        | FK → Household, `onDelete: Cascade`, indexed                           |
| role        | Role          | only `MEMBER` or `GUEST` (shared schema; API rejects `ADMIN`)          |
| tokenHash   | String        | SHA-256 hex of the token, **unique**; the token itself is never stored |
| createdById | String?       | FK → User, `onDelete: SetNull`                                         |
| expiresAt   | DateTime      | `createdAt + 12h`                                                      |
| usedAt      | DateTime?     | set on accept                                                          |
| usedById    | String?       | FK → User, `onDelete: SetNull`                                         |
| revokedAt   | DateTime?     | set on revoke or renew                                                 |
| createdAt   | DateTime      | default now                                                            |

States (derived, never stored):

```
pending  = usedAt null AND revokedAt null AND expiresAt > now
expired  = usedAt null AND revokedAt null AND expiresAt ≤ now
used     = usedAt not null
revoked  = revokedAt not null (and usedAt null)
```

Transitions: `pending → used` (accept), `pending|expired → revoked` (revoke or renew), and `pending → expired` with time. Terminal: `used`, `revoked`.

Rules: at most **10 pending** per household (checked when creating or renewing). The admin list shows `pending` and `expired` (renewable or dismissible with Revoke); `used` and `revoked` are hidden.

## User (`users`), existing model, one new field

| Field                | Type    | Rules                                                                                                                              |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| removedFromHousehold | String? | name of the household the person was removed from; cleared after the web shows it, or when the person creates or joins a household |

Plus back-relations: `membership` (0–1), `invitationsCreated`, `invitationsUsed`.

## Derived views (not stored)

- **Share basis points** per member: `weightsToBasisPoints(weights in member order)` from `packages/shared`, summing to 10000. Shown as whole percentages.
- **splitNeedsReview:** `memberCount ≥ 2 && (splitSavedAt == null || splitSavedAt < membersChangedAt || all weights are 0)`.

## Test data reset

`apps/api/test/testApp.ts` truncates tables before each test. Add `"invitations"`, `"memberships"` and `"households"` to the `TRUNCATE … CASCADE` list.
