# API contract: Households

REST, JSON. Every endpoint requires `Authorization: Bearer <access token>` (`requireAuth`). Request bodies are validated with the Zod schemas in `packages/shared/src/household.ts`. Errors use the existing shape `{ "error": { "code": "<code>" } }`, and codes are added to `ERROR_CODES` with `en`/`es` messages.

Authorization legend: **any** = any member of the caller's household; **admin** = caller's role is `ADMIN`; **none** = signed-in user without a household.

## Types (shared, Zod)

```ts
Role = "ADMIN" | "MEMBER" | "GUEST"
InvitableRole = "MEMBER" | "GUEST"

MemberView = { id: string /* membershipId */, userId: string, name: string, avatarUrl: string | null,
               role: Role, weight: number, shareBps: number, joinedAt: string /* ISO */ }

HouseholdView = { id: string, name: string, myMembershipId: string, myRole: Role,
                  members: MemberView[] /* joinedAt asc, then id */, splitNeedsReview: boolean }

CurrentHousehold = { household: HouseholdView } | { household: null, removedFrom: string | null }

InvitationView = { id: string, role: InvitableRole, createdByName: string | null,
                   expiresAt: string, status: "pending" | "expired" }

CreatedInvitation = { invitation: InvitationView, token: string }  // token returned only here

InvitationPreview = { householdName: string, inviterName: string | null, role: InvitableRole,
                      expiresAt: string,
                      viewer: "can_join" | "already_member" | "has_other_household" }
```

## Household

| Method & path                   | Auth      | Body       | Success                                | Errors                                                                                    |
| ------------------------------- | --------- | ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/household`            | signed in | —          | 200 `CurrentHousehold`                 | —                                                                                         |
| `POST /api/household`           | none      | `{ name }` | 201 `{ household: HouseholdView }`     | 400 `household.name.required` / `household.name.too_long`; 409 `household.already_member` |
| `PATCH /api/household`          | admin     | `{ name }` | 200 `{ household }`                    | 400 name codes; 403 `household.forbidden`; 404 `household.not_member`                     |
| `POST /api/household/leave`     | any       | —          | 204 (household deleted if last member) | 404 `household.not_member`; 409 `household.last_admin`                                    |
| `DELETE /api/me/removal-notice` | signed in | —          | 204                                    | —                                                                                         |

## Members

| Method & path                                 | Auth  | Body             | Success             | Errors                                                                                                         |
| --------------------------------------------- | ----- | ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PATCH /api/household/members/:membershipId`  | admin | `{ role: Role }` | 200 `{ household }` | 400 `request.invalid`; 403 `household.forbidden`; 404 `household.member_not_found`; 409 `household.last_admin` |
| `DELETE /api/household/members/:membershipId` | admin | —                | 200 `{ household }` | 403; 404 `household.member_not_found`; 409 `household.last_admin`                                              |

Removing yourself through this endpoint is rejected with 400 `request.invalid`; use `/leave`. A removed user gets `removedFromHousehold` set.

## Split

| Method & path              | Auth  | Body                                                                          | Success             | Errors                                                                                                               |
| -------------------------- | ----- | ----------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/household/split` | admin | `{ weights: { membershipId, weight }[] }` (every current member exactly once) | 200 `{ household }` | 400 `split.weight.invalid` / `split.all_zero`; 403; 409 `split.members_changed` (list doesn't match current members) |

## Invitations (admin side)

| Method & path                               | Auth  | Body                      | Success                                                                     | Errors                                                          |
| ------------------------------------------- | ----- | ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/household/invitations`            | admin | —                         | 200 `{ invitations: InvitationView[] }` (pending and expired, newest first) | 403; 404                                                        |
| `POST /api/household/invitations`           | admin | `{ role: InvitableRole }` | 201 `CreatedInvitation`                                                     | 400; 403; 409 `invitation.limit_reached`                        |
| `POST /api/household/invitations/:id/renew` | admin | —                         | 201 `CreatedInvitation` (old one revoked)                                   | 403; 404 `invitation.not_found`; 409 `invitation.limit_reached` |
| `DELETE /api/household/invitations/:id`     | admin | —                         | 204 (revoked)                                                               | 403; 404 `invitation.not_found`                                 |

## Invitations (invitee side)

Tokens travel in the body, never in the URL (research R2).

| Method & path                  | Auth      | Body        | Success                            | Errors                                                                                                                                                  |
| ------------------------------ | --------- | ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/invitations/lookup` | signed in | `{ token }` | 200 `InvitationPreview`            | 404 `invitation.not_found`; 410 `invitation.expired` / `invitation.used` / `invitation.revoked`                                                         |
| `POST /api/invitations/accept` | signed in | `{ token }` | 200 `{ household: HouseholdView }` | 404 / 410 as above; 409 `household.already_member` (in another household; if already in this one, also 409 with the same code, and the web routes home) |

Lookup and accept share a rate limit (for example 30 requests per 15 minutes per IP), like `/api/auth`.

## Permission matrix (each cell gets a Supertest case)

| Endpoint                 | ADMIN         | MEMBER        | GUEST         | other household                    | no household  |
| ------------------------ | ------------- | ------------- | ------------- | ---------------------------------- | ------------- |
| GET household            | 200           | 200           | 200           | own view                           | 200 null      |
| POST household           | 409           | 409           | 409           | 409                                | 201           |
| PATCH household          | 200           | 403           | 403           | n/a (acts on own)                  | 404           |
| leave                    | 204/409       | 204           | 204           | n/a                                | 404           |
| PATCH/DELETE member      | 200/409       | 403           | 403           | 404 (id not in own household)      | 404           |
| PUT split                | 200           | 403           | 403           | 409/404 (ids not in own household) | 404           |
| invitations (admin side) | 2xx           | 403           | 403           | 404 (id not in own household)      | 404           |
| lookup / accept          | preview / 409 | preview / 409 | preview / 409 | preview / 409                      | preview / 200 |

## New error codes

`household.name.required`, `household.name.too_long`, `household.already_member`, `household.not_member`, `household.forbidden`, `household.last_admin`, `household.member_not_found`, `invitation.not_found`, `invitation.expired`, `invitation.used`, `invitation.revoked`, `invitation.limit_reached`, `split.weight.invalid`, `split.all_zero`, `split.members_changed`.
