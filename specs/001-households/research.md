# Research: Households with link invitations, members and a weighted split

All Technical Context items were resolvable from the codebase and the constitution; no open clarifications remain. Each decision below lists what was chosen, why, and what was rejected.

## R1 · Copying a pending invitation link vs. hashed tokens

- **Decision:** The full link is shown, with a copy button, only in the response to creating (or renewing) an invitation. The pending list shows role, creator and time left, with **Revoke** and **New link**. "New link" revokes the old invitation and creates a fresh one with the same role and a new 12-hour window, then shows its link to copy.
- **Rationale:** The constitution requires invitation tokens to be stored hashed (principle III). A hash can't be turned back into the link, so "copy a pending link later" is impossible without storing the token in a recoverable form. "New link" covers the same need ("I lost the link, give me one to paste") in one click.
- **Alternatives rejected:** Encrypting the token with a server key (recoverable, which breaks "never stored in plain text"). Storing the token in the browser (lost on another device and an XSS target). **The spec was updated** (FR-009, US2 scenarios 1 and 10) to match.

## R2 · Where the token travels

- **Decision:** Web link format `https://<origin>/invite#<token>`. The web reads the fragment and sends the token in a JSON body to `POST /api/invitations/lookup` and `POST /api/invitations/accept`.
- **Rationale:** URL fragments are never sent to servers, so the token doesn't end up in Vercel/Render access logs or `Referer` headers; request bodies aren't logged either. Single-use plus a 12-hour expiry limits damage further.
- **Alternatives rejected:** `/invite/<token>` paths and `GET /api/invitations/:token` (the token lands in proxy and server logs).

## R3 · Token format and hashing

- **Decision:** 32 random bytes from `crypto.randomBytes`, base64url-encoded (43 chars); stored as a SHA-256 hex hash with a unique index, the same scheme as refresh tokens in `apps/api/src/auth/tokens.ts`.
- **Rationale:** 256 bits of entropy make guessing infeasible, so a fast hash is enough (no need for bcrypt/argon2, which exist to slow down brute force on low-entropy passwords). Reusing the existing helper keeps one pattern in the codebase.

## R4 · Single use under concurrency (SC-005)

- **Decision:** Accepting runs in one transaction. First a conditional `updateMany` marks the invitation used only `WHERE usedAt IS NULL AND revokedAt IS NULL AND expiresAt > now`. If the update count is 0, the code tells which state applies (`used`/`revoked`/`expired`). Otherwise it creates the `Membership`. The unique `Membership.userId` makes a second household impossible even if two different links are accepted at once (Prisma `P2002` → `household.already_member`).
- **Rationale:** It is atomic at the database level without explicit locks, and Supertest can drive two accepts in parallel to prove it.
- **Alternatives rejected:** read-then-write in application code (a race window), and `SELECT … FOR UPDATE` (more code for the same guarantee).

## R5 · "At least one admin" invariant

- **Decision:** A pure function in `packages/shared` (`checkAdminInvariant(members, change)`) decides whether a leave/remove/role change keeps an ADMIN. The API runs it inside the same transaction that applies the change, after re-reading the members, so two concurrent demotions can't both pass. The web uses the same function only to disable buttons and explain why.
- **Rationale:** One tested rule shared by both sides, as principle II asks for domain logic. The server stays the authority (principle III).
- **Alternatives rejected:** a database trigger (hard to test and to translate into an error code), and duplicating the rule in web and API.

## R6 · Weights to percentages

- **Decision:** `packages/shared/src/split.ts` exports `weightsToBasisPoints(weights: number[]): number[]`. Each share is `floor(10000 × w / Σw)`, and the leftover basis points go one each to the first members in order, so the result always sums to exactly 10000. The UI shows `Math.round(bps / 100)` % through `Intl.NumberFormat` with the active locale. All-zero input throws, and the API and the form both reject it beforehand. Later, the expenses feature will reuse the same leftover rule for cents.
- **Rationale:** Integer-only math (principle II), deterministic leftovers as the constitution specifies, and a single function to unit-test edge cases (one member, all equal, weight 0, 100:1, primes).
- **Alternatives rejected:** floating-point percentages (drift), and largest-remainder allocation (it doesn't match the constitution's "first members" rule).

## R7 · Member order

- **Decision:** Members are ordered by `joinedAt` ascending, then `id`. This order drives the members list, the split section and "first members" for leftovers.
- **Rationale:** Stable, explainable ("whoever joined first"), and it doesn't change when someone renames themselves.

## R8 · Split review banner

- **Decision:** `Household.membersChangedAt` is set on create, join, leave and remove. `Household.splitSavedAt` is set when weights are saved. `splitNeedsReview = memberCount ≥ 2 && (splitSavedAt == null || splitSavedAt < membersChangedAt)`; all-zero weights also set it. It is computed server-side in the household view.
- **Rationale:** Two timestamps instead of an event log. A household of one never shows the banner, since there is nothing to split.

## R9 · Removal notice

- **Decision:** Nullable `User.removedFromHousehold` (the household's name), set when an admin removes someone and cleared by `DELETE /api/me/removal-notice` after the web shows it. `GET /api/household` returns it alongside `household: null`.
- **Rationale:** One field covers "shown once on the next visit, any device" (FR-021). A user can only be removed from one household at a time, and a later removal just overwrites the name.
- **Alternatives rejected:** clearing the notice on read (a GET with side effects), and a notifications table (no other notification type exists yet).

## R10 · API shape: a singular `/api/household`

- **Decision:** Because a user has at most one household, every household endpoint is a singular resource resolved from the caller (`/api/household`, `/api/household/members/:membershipId`, …). No household id ever comes from the client.
- **Rationale:** It removes a whole class of "acts on another household" bugs. Ids of members and invitations are still checked to belong to the caller's household, and get 404 (`household.not_found`-style codes) if not, so other households' existence isn't revealed.

## R11 · UI building blocks

- **Decision:** New `packages/ui` components: **TextField** (label, hint, error; also used for weight inputs with `type="number"`), **Dialog** (Radix `@radix-ui/react-dialog`; confirmations, the create form, the "copy link" view) and **Alert** (tone `info`/`warning`/`danger`, with icon plus text so color never stands alone). The member role change reuses `Menu` + `MenuRadioGroup`. The invite role choice is a small radio fieldset local to the web.
- **Rationale:** Only what this feature needs. Each new component follows the `Button` reference (test with axe, story, bilingual MDX), as principles IV and VI require. Radix is already used for `Menu`, so focus trapping and `aria-modal` come for free.
- **Alternatives rejected:** a generic Select/RadioGroup in `ui` now (YAGNI until a second consumer appears).

## R12 · Refreshing without real time

- **Decision:** The household query (`["household"]`) sets `refetchOnWindowFocus: true` (the app default is off) and is invalidated by every household mutation.
- **Rationale:** It meets "data refreshes on navigation/focus" from the spec until the real-time feature arrives.

## R13 · Returning to the invitation after sign-in

- **Decision:** `RequireAuth` passes the current location (path plus hash) as `state.from` when redirecting to `/login`; `RedirectIfAuthenticated` navigates to `state.from` (only when it is a same-app path) instead of always `/`. The Google popup flow keeps the page and its state alive.
- **Rationale:** It is the smallest change to the existing guards in `apps/web/src/auth/guards.tsx`, and restricting `from` to internal paths avoids an open redirect.

## R14 · Local database for migrations and API tests

- **Decision:** `prisma migrate dev --name households` against the Docker Compose Postgres 17 (`pnpm db:up`), the same major version CI uses. API tests run locally against `hogar_test` before any task is marked done.
- **Rationale:** The migration must be generated by Prisma, not handwritten. The weight range check (`CHECK (weight BETWEEN 0 AND 100)`) is added to the generated SQL, since Prisma's schema can't express it.
