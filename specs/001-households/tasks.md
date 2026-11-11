# Tasks: Households with link invitations, members and a weighted split

**Input**: Design documents from `specs/001-households/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: Required. Constitution principle IV: unit tests for domain logic, Supertest for every endpoint including role and other-household cases, a test plus story for every ui component, and Cypress for the main flows. Within each story, test tasks come first and must fail before implementation.

**Organization**: Tasks are grouped by user story so each one can be implemented, tested and demoed on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repository root

## Path Conventions

- Shared: `packages/shared/src/` · API: `apps/api/src/`, tests in `apps/api/test/` · UI: `packages/ui/src/components/<Name>/` · Web: `apps/web/src/` · E2E: `apps/web/cypress/e2e/`
- UI component folders follow `packages/ui/src/components/Button/` (tsx, module.css, test with axe, stories, bilingual mdx)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and environment needed by every story.

- [x] T001 Confirm the baseline: Docker Postgres up (`pnpm db:up`), `pnpm typecheck` and `pnpm test` green on `feat/households` before any change
- [x] T002 Add `@radix-ui/react-dialog` (current 1.x, matching the Radix family already used by `Menu`) to `packages/ui/package.json` with `pnpm --filter @hogar/ui add @radix-ui/react-dialog`, and commit the lockfile
- [x] T003 [P] Add the `household` i18n namespace: create `apps/web/src/i18n/locales/en/household.json` and `apps/web/src/i18n/locales/es/household.json` (empty objects for now) and register them in `apps/web/src/i18n/resources.ts` so keys are typed through `apps/web/src/i18n/i18next.d.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain logic, schemas, data model and request plumbing that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared domain logic (tests first)

- [x] T004 [P] Write unit tests for `weightsToBasisPoints` in `packages/shared/src/split.test.ts`: result always sums to 10000; equal weights; `[3, 1]` → `[7500, 2500]`; `[1, 1, 1]` → `[3334, 3333, 3333]` (leftover to the first members); a zero weight gets 0; single member → `[10000]`; `[100, 1]`; empty or all-zero input throws
- [x] T005 [P] Write unit tests for `checkAdminInvariant` in `packages/shared/src/permissions.test.ts`: covers leave, remove and role change for sole admin with others (rejected), sole admin as only member leaving (allowed, deletes household), two admins demoting or removing one (allowed), demoting the last admin (rejected), MEMBER/GUEST changes (allowed); plus `canManageHousehold(role)` true only for `ADMIN`
- [x] T006 [P] Implement `weightsToBasisPoints(weights: number[]): number[]` in `packages/shared/src/split.ts`: integer math only, each share `floor(10000 × w / Σw)`, leftover basis points one each to the first members in order, throw on empty or Σw = 0 (research R6)
- [x] T007 [P] Implement `checkAdminInvariant(members, change)` and `canManageHousehold(role)` in `packages/shared/src/permissions.ts`, where `members: { id: string; role: Role }[]` and `change` is `{ type: "leave" | "remove"; membershipId } | { type: "role"; membershipId; role }`, returning `"ok" | "deletes_household" | "last_admin"` (research R5)

### Shared schemas and error codes

- [x] T008 Write schema tests in `packages/shared/src/household.test.ts`: the name is trimmed and must be 1–50 chars (`household.name.required` when empty or only spaces, `household.name.too_long` when over 50); `invitableRoleSchema` rejects `ADMIN`; weight must be an integer 0–100 (`split.weight.invalid`); a split request with all zero weights fails with `split.all_zero`; the token schema requires a non-empty string
- [x] T009 Implement `packages/shared/src/household.ts` per `contracts/api.md` › Types: `roleSchema`, `invitableRoleSchema`, `householdNameSchema`, `weightSchema`, request schemas (`createHouseholdRequestSchema`, `renameHouseholdRequestSchema`, `createInvitationRequestSchema`, `invitationTokenRequestSchema`, `changeRoleRequestSchema`, `updateSplitRequestSchema`) and response schemas/types (`memberViewSchema`, `householdViewSchema`, `currentHouseholdSchema`, `invitationViewSchema`, `createdInvitationSchema`, `invitationPreviewSchema`). Zod issues carry error codes as messages, not sentences
- [x] T010 Add the 15 new codes from `contracts/api.md` › New error codes to `ERROR_CODES` in `packages/shared/src/errors.ts`, and export `household`, `split` and `permissions` from `packages/shared/src/index.ts`
- [x] T011 Add warm `en` and `es` messages for the 15 new codes in `apps/web/src/i18n/locales/en/errors.json` and `apps/web/src/i18n/locales/es/errors.json` (for example `household.last_admin`: "Make someone else an admin first, so the household is never left without one."), and confirm `apps/web/src/i18n/i18n.test.ts` passes

### Data model

- [x] T012 Add to `apps/api/prisma/schema.prisma` per `data-model.md`: `enum Role { ADMIN MEMBER GUEST }`; `Household` (`name`, `membersChangedAt`, `splitSavedAt?`, timestamps, `@@map("households")`); `Membership` (`householdId` FK `onDelete: Cascade` + index, `userId` FK `onDelete: Cascade` **`@unique`**, `role`, `weight Int @default(1)`, `joinedAt`, `@@map("memberships")`); `Invitation` (`householdId` FK cascade + index, `role`, `tokenHash @unique`, `createdById?` FK `onDelete: SetNull`, `expiresAt`, `usedAt?`, `usedById?` FK `onDelete: SetNull`, `revokedAt?`, `createdAt`, `@@map("invitations")`); `User.removedFromHousehold String? @map("removed_from_household")` plus back-relations. Snake_case `@map` on every column, as in the existing models
- [x] T013 Generate the migration with `pnpm --filter @hogar/api exec prisma migrate dev --name households`, then append `ALTER TABLE "memberships" ADD CONSTRAINT "memberships_weight_range" CHECK ("weight" BETWEEN 0 AND 100);` to the generated `apps/api/prisma/migrations/<timestamp>_households/migration.sql` and re-run `prisma migrate reset --force` locally to verify it applies cleanly
- [x] T014 Update `apps/api/test/testApp.ts`: add `"invitations", "memberships", "households"` to the `TRUNCATE … CASCADE` statement; add more fake Google identities (`bruno`, `carla`, `dani`) and a `signIn(app, identity)` helper that returns a ready Bearer header, reusing the login flow from `apps/api/test/me.test.ts`

### Request plumbing

- [x] T015 Add `notFound(code)` and `conflict(code)` (and `gone(code)` for 410) helpers to `apps/api/src/httpError.ts`
- [x] T016 Implement `apps/api/src/household/loadMembership.ts`: a `loadMembership(db)` middleware that reads the caller's `Membership` (by `req.auth.sub`) into `req.membership` or throws 404 `household.not_member`, and a `requireAdmin` middleware that throws 403 `household.forbidden` unless `req.membership.role === "ADMIN"` (Express `Request` augmentation as in `apps/api/src/auth/requireAuth.ts`)
- [x] T017 Implement `buildHouseholdView(db, householdId, viewerUserId)` in `apps/api/src/household/householdView.ts`: loads members ordered by `joinedAt` then `id` with user name/avatar, computes `shareBps` via `weightsToBasisPoints` (all zeros → every `shareBps` 0), and computes `splitNeedsReview = memberCount ≥ 2 && (splitSavedAt == null || splitSavedAt < membersChangedAt || all weights are 0)` (research R8), returning a `HouseholdView`

**Checkpoint**: shared tests green, migration applied, typecheck green. Stories can start.

---

## Phase 3: User Story 1 - Create a household (Priority: P1) 🎯 MVP

**Goal**: A signed-in user without a household creates one (name only), becomes its ADMIN with weight 1, and sees it on the home page; admins can rename it.

**Independent Test**: Sign in without a household, create "Casa Ana", and check the home shows it with that user as the only member and admin.

### Tests for User Story 1 ⚠️

- [x] T018 [P] [US1] Supertest suite `apps/api/test/household.test.ts`: `GET /api/household` → `{ household: null, removedFrom: null }` without a household; `POST` creates (201, ADMIN, weight 1, `shareBps` 10000, `splitNeedsReview` false); name validation (empty, spaces only, 51 chars → 400 with codes); a second `POST` → 409 `household.already_member`; `PATCH` as ADMIN renames, as MEMBER/GUEST → 403 `household.forbidden`, without a household → 404 `household.not_member`; anonymous → 401. Seed MEMBER/GUEST memberships directly through `db` until US2 exists
- [x] T019 [P] [US1] `TextField` tests in `packages/ui/src/components/TextField/TextField.test.tsx`: label linked to the input, hint and error linked with `aria-describedby`, `aria-invalid` when there is an error, `type="number"` passthrough, axe has no violations
- [x] T020 [P] [US1] `Dialog` tests in `packages/ui/src/components/Dialog/Dialog.test.tsx`: opens and closes, focus moves inside and returns, Escape closes, `title` and `closeLabel` props are required and rendered accessibly, axe has no violations
- [x] T021 [P] [US1] HomePage tests in `apps/web/src/pages/HomePage/HomePage.test.tsx` (MSW handlers in `apps/web/src/test/server.ts`): the no-household state enables "Create a household"; creating shows inline errors from codes and, on success, the household home with name and members summary; a household state renders the name, a link to settings and, for admins, the split banner when `splitNeedsReview`; axe passes

### Implementation for User Story 1

- [x] T022 [US1] Implement `createHousehold`, `renameHousehold` and `getCurrentHousehold` in `apps/api/src/household/householdService.ts`. Create runs in one transaction (household + ADMIN membership with weight 1, `membersChangedAt = now`) and maps Prisma `P2002` on `Membership.userId` to 409 `household.already_member`. `getCurrent` returns `{ household: null, removedFrom: user.removedFromHousehold }` when there's no membership. Use the injected clock (`now`) like `authService`
- [x] T023 [US1] Implement `apps/api/src/household/householdRouter.ts` with `GET /`, `POST /` and `PATCH /` (`loadMembership` + `requireAdmin` on PATCH), validating bodies with the shared schemas (`badRequest(code)` from the first Zod issue), and mount it in `apps/api/src/app.ts` at `/api/household` behind `requireAuth(signer)`
- [x] T024 [P] [US1] Build `packages/ui/src/components/TextField/` (TextField.tsx, TextField.module.css with tokens only, TextField.stories.tsx with en/es copy, TextField.mdx bilingual with the why and how it helps) and export it from `packages/ui/src/index.ts`
- [x] T025 [P] [US1] Build `packages/ui/src/components/Dialog/` on `@radix-ui/react-dialog` (Dialog.tsx with `open`, `onOpenChange`, `title`, `description?`, `closeLabel`, `children`, `actions`; module.css; stories; bilingual mdx) and export it from `packages/ui/src/index.ts`
- [x] T026 [US1] Add household methods to `apps/web/src/api/client.ts` (`getHousehold`, `createHousehold`, `renameHousehold`) parsing responses with the shared schemas
- [x] T027 [US1] Create `apps/web/src/household/useHousehold.ts`: a `useHousehold()` query on key `["household"]` with `refetchOnWindowFocus: true` (research R12), plus `useCreateHousehold` and `useRenameHousehold` mutations that update or invalidate that key
- [x] T028 [US1] Rework `apps/web/src/pages/HomePage/HomePage.tsx` and its CSS module: the no-household state (enabled create button opening a `Dialog` with a `TextField`; join explanation; remove the "Coming soon" badge and its keys from `home.json`) and the household state (name, member avatars, link to `/household/settings`); copy in `household.json` en/es
- [x] T029 [US1] Add a minimal `/household/settings` route in `apps/web/src/App.tsx` and `apps/web/src/pages/HouseholdSettingsPage/HouseholdSettingsPage.tsx` with the **Name** section (rename form for admins, read-only for others) and a redirect to `/` without a household; test it in `HouseholdSettingsPage.test.tsx`

**Checkpoint**: US1 is demoable: create, see and rename a household.

---

## Phase 4: User Story 2 - Invite someone with a link and let them join (Priority: P2)

**Goal**: Admins create single-use 12-hour links for MEMBER or GUEST; invitees open `/invite#token`, sign in if needed, and join explicitly.

**Independent Test**: As an admin, create an invitation; as a second user without a household, open the link, join, and check membership, role and weight; the link then reports "used".

### Tests for User Story 2 ⚠️

- [x] T030 [P] [US2] Supertest suite `apps/api/test/invitations.test.ts`:
  - Create (201, token returned once; DB stores only `sha256(token)`); MEMBER/GUEST → 403; `role: "ADMIN"` → 400; the 11th pending → 409 `invitation.limit_reached`.
  - List shows pending and expired only, newest first; renew revokes the old one and returns a new token with the same role and a fresh `expiresAt`; revoke → 204 and the token stops working; invitation ids from another household → 404.
  - Lookup returns the preview with `viewer` = `can_join` / `already_member` / `has_other_household`; unknown → 404 `invitation.not_found`; expired after `clock.advance(12h)` → 410 `invitation.expired`; used → 410 `invitation.used`; revoked → 410 `invitation.revoked`.
  - Accept joins with weight 1 (MEMBER) or 0 (GUEST) and bumps `membersChangedAt`; already in another household → 409 `household.already_member` and the invitation stays pending.
  - Two concurrent accepts (`Promise.all`) by different users → exactly one 200 and one 410 `invitation.used`.
  - The token never appears in any URL.
- [x] T031 [P] [US2] `Alert` tests in `packages/ui/src/components/Alert/Alert.test.tsx`: tones `info`/`warning`/`danger` render an icon plus text; `role="status"` for info/warning and `role="alert"` for danger; optional action slot; axe has no violations
- [x] T032 [P] [US2] Guard tests in `apps/web/src/auth/guards.test.tsx`: an anonymous visit to `/invite#abc` redirects to `/login` with `state.from = "/invite#abc"`; after sign-in `RedirectIfAuthenticated` returns there; an external or absolute `from` is ignored (falls back to `/`)
- [x] T033 [P] [US2] InvitePage tests in `apps/web/src/pages/InvitePage/InvitePage.test.tsx`: reads the token from the hash and calls lookup; `can_join` shows household, inviter and role and joins only on clicking "Join"; `already_member` links home; `has_other_household` explains and offers to leave (confirmation dialog); used/expired/revoked/not-found show a kind message suggesting a new link; axe passes in each state
- [x] T034 [P] [US2] Invitations section tests in `apps/web/src/pages/HouseholdSettingsPage/InvitationsSection.test.tsx`: admins can create with a role choice and see the copy view with `${origin}/invite#${token}` and the "works once, 12 hours" note; the list shows role, creator and relative time left; "New link" shows a fresh copy view; "Revoke" asks for confirmation; non-admins don't see the section

### Implementation for User Story 2

- [x] T035 [US2] Expose a `createRandomToken()` / `hashToken(token)` pair from `apps/api/src/auth/tokens.ts` (reusing the refresh-token implementation: 32 random bytes base64url and SHA-256 hex) without changing auth behavior (research R3)
- [x] T036 [US2] Implement `apps/api/src/household/invitationService.ts`:
  - `create(membership, role)`: count pending ≤ 10, `expiresAt = now + 12h`.
  - `list(householdId)`: pending and expired, newest first, with `createdByName`.
  - `renew(id)`: in one transaction, revoke the old one, then create a new one with the same role.
  - `revoke(id)`: scoped to the caller's household, 404 otherwise.
  - `lookup(token, userId)`: preview plus `viewer`, and 404/410 codes.
  - `accept(token, userId)`: in one transaction, a conditional `updateMany` (`usedAt null`, `revokedAt null`, `expiresAt > now`) then create the `Membership` with the default weight (MEMBER 1, GUEST 0) and set `membersChangedAt`; `P2002` → 409 `household.already_member`; zero rows updated → 410 with the precise code (research R4).
- [x] T037 [US2] Implement `apps/api/src/household/invitationRouter.ts`: admin routes under `/api/household/invitations` (GET, POST, `POST /:id/renew`, `DELETE /:id`) with `loadMembership` + `requireAdmin`, and invitee routes `POST /api/invitations/lookup` and `POST /api/invitations/accept` with the token in the body behind their own rate limiter (30 per 15 min per IP, same 429 shape as `/api/auth`); mount both in `apps/api/src/app.ts`
- [x] T038 [P] [US2] Build `packages/ui/src/components/Alert/` (Alert.tsx with `tone`, `title?`, `children`, `action?`; lucide icon per tone so color never carries meaning alone; module.css tokens only; stories; bilingual mdx) and export it from `packages/ui/src/index.ts`
- [x] T039 [US2] Update `apps/web/src/auth/guards.tsx`: `RequireAuth` passes `state.from` (pathname + search + hash) when redirecting to `/login`, and `RedirectIfAuthenticated` navigates to `state.from` only if it starts with `/` and not `//`, else `/` (research R13)
- [x] T040 [US2] Add invitation methods to `apps/web/src/api/client.ts` (`listInvitations`, `createInvitation`, `renewInvitation`, `revokeInvitation`, `lookupInvitation`, `acceptInvitation`) and matching hooks in `apps/web/src/household/useInvitations.ts` (query key `["household", "invitations"]`; accept invalidates `["household"]`)
- [x] T041 [US2] Build `apps/web/src/pages/InvitePage/` (InvitePage.tsx + module.css) with all lookup states, the explicit Join action, and "Leave my household" for `has_other_household` (reuses the leave mutation from US3 once available; until then it links to settings). Register `/invite` under `RequireAuth` in `apps/web/src/App.tsx`
- [x] T042 [US2] Build `apps/web/src/pages/HouseholdSettingsPage/InvitationsSection.tsx` (create dialog with a role radio fieldset defaulting to MEMBER, copy view with a clipboard button and fallback text selection, pending list with `Intl.RelativeTimeFormat` time left, New link and Revoke with confirmation) and render it in the settings page for admins; copy in `household.json` en/es

**Checkpoint**: US1 + US2 work together: a household can be created and others can join it.

---

## Phase 5: User Story 3 - Manage members and roles (Priority: P3)

**Goal**: Admins change roles and remove members (including admins), anyone can leave, and the household always keeps an admin; removed people get a one-time note.

**Independent Test**: In a multi-member household, change roles, remove a member and leave, checking that no action leaves the household without an admin and that the removed person sees the note once.

### Tests for User Story 3 ⚠️

- [x] T043 [P] [US3] Supertest suite `apps/api/test/members.test.ts`:
  - `PATCH /members/:id` role changes as ADMIN (to ADMIN/MEMBER/GUEST; weight unchanged); demoting the last admin → 409 `household.last_admin`; MEMBER/GUEST → 403; an id from another household → 404 `household.member_not_found`.
  - `DELETE /members/:id` removes (sets `removedFromHousehold` on that user, bumps `membersChangedAt`); removing another admin when two exist → 200; removing self → 400 `request.invalid`.
  - `POST /leave`: as a MEMBER → 204; as the sole admin with others → 409 `household.last_admin`; as the only member → 204 and the household plus its invitations are deleted.
  - `DELETE /api/me/removal-notice` clears the note, and `GET /api/household` returns `removedFrom` until then.
  - Two admins demoting each other concurrently → one ends as admin.
- [x] T044 [P] [US3] Members section tests in `apps/web/src/pages/HouseholdSettingsPage/MembersSection.test.tsx`: lists members with avatar, name and role badge; admins get a role menu and Remove with confirmation; disabled actions explain why using `checkAdminInvariant` ("You're the only admin"); non-admins see the list read-only plus Leave; leaving as the last member warns that the household will be deleted
- [x] T045 [P] [US3] HomePage removal note test in `apps/web/src/pages/HomePage/HomePage.test.tsx`: `removedFrom: "Casa Ana"` shows a gentle `Alert` naming it and calls `DELETE /api/me/removal-notice` once

### Implementation for User Story 3

- [x] T046 [US3] Implement `changeRole`, `removeMember` and `leave` in `apps/api/src/household/householdService.ts`. Each runs in a transaction that re-reads members and applies `checkAdminInvariant` (409 `household.last_admin`). Remove sets `User.removedFromHousehold` to the household name. Remove and leave bump `membersChangedAt`. "Deletes household" deletes the household (cascade). Member ids are scoped to the caller's household (404 `household.member_not_found`)
- [x] T047 [US3] Add `PATCH /members/:membershipId`, `DELETE /members/:membershipId` (ADMIN) and `POST /leave` (any member) to `apps/api/src/household/householdRouter.ts`, and `DELETE /removal-notice` to `apps/api/src/me/meRouter.ts`
- [x] T048 [US3] Add `changeRole`, `removeMember`, `leaveHousehold` and `dismissRemovalNotice` to `apps/web/src/api/client.ts`, with mutations in `apps/web/src/household/useHousehold.ts` (leave and remove invalidate `["household"]`)
- [x] T049 [US3] Build `apps/web/src/pages/HouseholdSettingsPage/MembersSection.tsx` (Avatar, name, role Badge, admin `Menu` with `MenuRadioGroup` for the role and Remove with a `Dialog` confirmation, Leave with a confirmation that warns when it deletes the household, explanations for disabled actions) and render it in the settings page; copy in `household.json` en/es
- [x] T050 [US3] Show the removal note in `apps/web/src/pages/HomePage/HomePage.tsx` with `Alert` (info tone, gentle copy naming the household) and dismiss it once through `dismissRemovalNotice`; wire "Leave my household" in `InvitePage` to the leave mutation

**Checkpoint**: US1–US3 work: households can be formed and corrected safely.

---

## Phase 6: User Story 4 - Agree on the default split (Priority: P4)

**Goal**: Everyone sees each member's weight and percentage; admins edit weights; a banner asks admins to review the split after membership changes.

**Independent Test**: In a two-member household, set weights 3/1 and see 75 %/25 % for both; add a member and see the banner, which disappears after saving.

### Tests for User Story 4 ⚠️

- [x] T051 [P] [US4] Supertest suite `apps/api/test/split.test.ts`: `PUT /api/household/split` as ADMIN with every member exactly once → 200, weights saved, `shareBps` `[7500, 2500]`, `splitSavedAt` set and `splitNeedsReview` false; weight 101 / -1 / 1.5 → 400 `split.weight.invalid`; all zeros → 400 `split.all_zero`; a missing or extra or foreign membershipId → 409 `split.members_changed`; MEMBER/GUEST → 403; a join after saving makes `splitNeedsReview` true again; the DB `CHECK` rejects an out-of-range weight written directly
- [x] T052 [P] [US4] Split section tests in `apps/web/src/pages/HouseholdSettingsPage/SplitSection.test.tsx`: shows weights and whole-number percentages via `Intl.NumberFormat` (en and es formats); admins edit with live percentage updates and Save disabled while invalid or all zero; the warning `Alert` banner shows when `splitNeedsReview` and disappears after a successful save; non-admins see read-only values; axe passes

### Implementation for User Story 4

- [x] T053 [US4] Implement `updateSplit(membership, weights)` in `apps/api/src/household/householdService.ts`: in a transaction, verify the set of membershipIds equals the current members (else 409 `split.members_changed`), update weights, set `splitSavedAt = now`, and return the view
- [x] T054 [US4] Add `PUT /split` (ADMIN) to `apps/api/src/household/householdRouter.ts`, validated with `updateSplitRequestSchema`
- [x] T055 [US4] Add `updateSplit` to `apps/web/src/api/client.ts` and a mutation in `apps/web/src/household/useHousehold.ts`
- [x] T056 [US4] Build `apps/web/src/pages/HouseholdSettingsPage/SplitSection.tsx` (one `TextField type="number"` 0–100 per member in member order, live percentage from `weightsToBasisPoints` formatted with `Intl.NumberFormat`, Save, the warning `Alert` banner when `splitNeedsReview`, read-only for non-admins) and render it in the settings page; copy in `household.json` en/es

**Checkpoint**: all four stories work independently and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T057 [P] Cypress flows in `apps/web/cypress/e2e/household.cy.ts` with stubbed API (`cy.intercept`, following `apps/web/cypress/e2e/auth.cy.ts`): create a household from the empty home; invite → copy view → a second user's accept simulated by switching the stubbed `GET /api/household` response → the new member appears after refetch; invitation page states (valid, used, has another household); edit the split weights and see the banner disappear on save
- [x] T058 [P] Run the `docs/design.md` checklist on Home, Settings (three sections) and Invite in light and dark themes and in en and es, fixing anything found (tokens only, visible focus, color never alone, warm copy)
- [x] T059 [P] Update the status table in `README.md`: households, invitations, members and split become ✅, and expenses, chores, shopping list and real time stay 🔜
- [x] T060 Run the full gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (API against Docker `hogar_test`) and `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e`
- [ ] T061 Walk through the 10 manual scenarios in `specs/001-households/quickstart.md` with two browsers on `pnpm dev`, and fix any gap against the spec

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup and blocks all stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)**: depends on US1 (an admin needs a household to invite into). The API side can start after T022.
- **US3 (Phase 5)**: depends on US1. Its API tests seed memberships directly, so it can run in parallel with US2. The InvitePage "leave" wiring (T050) needs T041.
- **US4 (Phase 6)**: depends on US1. It can run in parallel with US2 and US3 (tests seed memberships directly).
- **Polish (Phase 7)**: after all stories.

### Within Each User Story

- Tests are written first and fail, then service, router, client and hooks, then UI.
- `householdService.ts`, `householdRouter.ts`, `client.ts` and `useHousehold.ts` are shared files, so tasks touching them run sequentially across stories.

### Parallel Opportunities

- Phase 2: T004–T007 run together (four separate files). T008 depends on T009's file only for imports, so write the tests first and then T009.
- US1: T018–T021 run together, and T024 and T025 (ui components) run in parallel with the API work T022–T023.
- US2: T030–T034 run together, and T038 (Alert) in parallel with T035–T037.
- Polish: T057–T059 run together.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
T018 apps/api/test/household.test.ts
T019 packages/ui/src/components/TextField/TextField.test.tsx
T020 packages/ui/src/components/Dialog/Dialog.test.tsx
T021 apps/web/src/pages/HomePage/HomePage.test.tsx

# Then, in parallel:
T022–T023 API (service → router)
T024 TextField   |   T025 Dialog
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1). **Stop and validate:** create, see and rename a household; the full gate is green.

### Incremental Delivery

1. US1, then validate and commit (`feat(api)`, `feat(ui)`, `feat(web)` commits per group).
2. US2: invitations and join. Validate two-user scenarios 2–5 from the quickstart.
3. US3: members, with scenarios 7–8.
4. US4: split, with scenario 6.
5. Polish, then the whole quickstart, then a PR to `main`.

## Notes

- `[P]` tasks touch different files and have no dependency on incomplete tasks.
- Commit after each task group with Conventional Commits in English, with no AI attribution.
- Stop at any checkpoint if format, lint, typecheck or tests are red.
- Mark tasks `[X]` in this file as they are completed.

## Phase 8: Convergence

- [x] T062 CRITICAL: Add Supertest role-permission cases for `POST /api/household/invitations/:id/renew` and `DELETE /api/household/invitations/:id` as MEMBER and GUEST (403 `household.forbidden`, invitation untouched) in `apps/api/test/invitations.test.ts`, plus `POST /api/household/leave` as GUEST (204) and `GET /api/household` as GUEST (read-only view) in `apps/api/test/members.test.ts` and `apps/api/test/household.test.ts` per Constitution IV (missing)
- [x] T063 CRITICAL: List every new UI copy key for `en` and `es` (the `household` namespace, `home.noHousehold.joinHint` and the 15 new `errors.*` codes) in a "New i18n keys" section of `specs/001-households/contracts/ui.md` per Constitution V (missing)
- [x] T064 Clear `User.removedFromHousehold` when the user creates a household (`householdService.create`) or joins one (`invitationService.accept`), and add a Supertest case where a removed person joins another household through a link and later leaves it, then sees no stale note, per FR-021 (partial)
- [x] T065 Review `TextField`, `Dialog` and `Alert` in Storybook in light and dark themes and with the Locale toolbar in `en` and `es` (canvas, docs page and chrome), fixing anything found, per Constitution VI / `docs/design.md` checklist (partial)
