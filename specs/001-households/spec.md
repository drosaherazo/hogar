# Feature Specification: Households with link invitations, members and a weighted split

**Feature Branch**: `feat/households`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Households with shareable-link invitations, member management and a weighted default split." Full input, from the design interview of 2026-11-10: create a household with just a name; ADMIN-only, single-use invitation links that expire after 12 hours and grant MEMBER or GUEST; an explicit join page that handles signed-out visitors and people who already have a household; several admins with an "at least one admin" invariant; leave and remove; per-member weights (0–100) edited by admins in household settings, with resulting percentages and a review banner when members change. Out of scope: real time, invitation emails, deleting a household explicitly, balance rules on leaving, expenses.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create a household (Priority: P1)

Ana has just signed in and has no household yet. From the home page she chooses "Create a household", gives it a name ("Casa Ana") and lands in her new household, where she is its admin.

**Why this priority**: Every other part of Hogar (expenses, chores, shopping list) lives inside a household. Without this, the app does nothing after sign-in.

**Independent Test**: Sign in as a user without a household, create one, and check that the home page now shows the household with that user as its only member and admin.

**Acceptance Scenarios**:

1. **Given** a signed-in user without a household, **When** they submit a name between 1 and 50 characters, **Then** the household is created, they become its only member with role ADMIN and weight 1, and they see the household home.
2. **Given** a signed-in user without a household, **When** they submit an empty name or one longer than 50 characters, **Then** nothing is created and they see a clear, friendly explanation next to the field.
3. **Given** a user who already belongs to a household, **When** they try to create another one (from any client), **Then** the request is rejected and their current household is unchanged.
4. **Given** an ADMIN, **When** they rename the household in settings with a valid name, **Then** every member sees the new name the next time their view refreshes.

---

### User Story 2 - Invite someone with a link and let them join (Priority: P2)

Ana wants Bruno to join. In settings she creates an invitation for the role MEMBER and copies the link, which she sends him over a messaging app. Bruno opens it, signs in with Google if needed, sees "Ana invites you to join Casa Ana as a member", and chooses "Join".

**Why this priority**: A household of one is not useful; this is how the people who live together end up in the same place. It depends on Story 1.

**Independent Test**: As an admin, create an invitation and copy its link; open it as a second user without a household, accept it, and check that the second user appears in the members list with the chosen role and their default weight, and that the link no longer works.

**Acceptance Scenarios**:

1. **Given** an ADMIN, **When** they create an invitation choosing MEMBER or GUEST, **Then** they get a link they can copy, valid for 12 hours, listed under pending invitations with its role and time remaining.
2. **Given** a MEMBER or GUEST, **When** they try to create an invitation (from any client), **Then** the request is rejected.
3. **Given** a valid link and a signed-out visitor, **When** they open it, **Then** they are asked to sign in and, after signing in, return to the same invitation page.
4. **Given** a valid link and a signed-in user without a household, **When** they open it, **Then** they see the household name, who invited them and the role, and nothing happens until they choose "Join".
5. **Given** that invitation page, **When** they choose "Join", **Then** they become a member with the invitation's role and default weight (1 for MEMBER, 0 for GUEST), the invitation is used up, and they see the household home.
6. **Given** a signed-in user who already belongs to a household, **When** they open a valid link, **Then** the page explains that they must leave their current household first, offers a way to do so, and the link stays valid until it expires.
7. **Given** a link that has been used, has expired or was revoked, **When** anyone opens it, **Then** they see a kind explanation of what happened and a suggestion to ask the person who invited them for a new link.
8. **Given** two people with the same valid link, **When** both choose "Join", **Then** only the first joins and the second sees that the link was already used.
9. **Given** a pending invitation, **When** an ADMIN revokes it, **Then** the link stops working immediately.
10. **Given** an expired invitation in the list, **When** an ADMIN chooses "New link", **Then** a fresh invitation with the same role is created in one step and its link is ready to copy.
11. **Given** a household with 10 pending invitations, **When** an ADMIN tries to create another, **Then** it is refused with an explanation, until one is used, revoked or expires.

---

### User Story 3 - Manage members and roles (Priority: P3)

Ana makes Bruno an admin too, so either of them can manage the household. Later Carla, a GUEST who was staying for a few months, moves out and leaves the household herself. When an old flatmate is no longer part of the home, an admin removes them.

**Why this priority**: People move in and out and responsibilities change; without this a household cannot be corrected once formed. It depends on Story 2 to have more than one member.

**Independent Test**: With a household of several members, change roles, remove a member and leave as a member, checking that each change is visible in the members list and that no action ever leaves the household without an admin.

**Acceptance Scenarios**:

1. **Given** an ADMIN, **When** they change another member's role to ADMIN, MEMBER or GUEST, **Then** the new role applies immediately to what that person can do.
2. **Given** an ADMIN, **When** they remove a member (including another ADMIN), **Then** that person is no longer part of the household and loses access to it.
3. **Given** a removed person, **When** they next open the app, **Then** they see the no-household screen with a gentle note that they are no longer part of that household.
4. **Given** any member, **When** they choose to leave and confirm, **Then** they are no longer part of the household and see the no-household screen.
5. **Given** a household where the person is the only ADMIN and there are other members, **When** they try to leave or demote themselves, **Then** it is refused with an explanation that they must make someone else admin first.
6. **Given** a household with two ADMINs, **When** one of them removes or demotes the other, **Then** it succeeds, because one admin remains.
7. **Given** a household with a single member, **When** that member leaves and confirms, **Then** the household and its pending invitations are deleted.
8. **Given** a MEMBER or GUEST, **When** they try to change roles or remove someone (from any client), **Then** the request is rejected.
9. **Given** a person who left or was removed, **When** they accept a new valid invitation to the same household, **Then** they join again like anyone else.

---

### User Story 4 - Agree on the default split (Priority: P4)

Ana earns more than Bruno, so they agree she covers three quarters of shared costs. In the household's "Split" settings, Ana sets her weight to 3 and Bruno's to 1, and both see 75 % and 25 %. When Carla joins later, a banner reminds the admins to review the split.

**Why this priority**: The default split is what future expenses will use, and agreeing on it openly lowers tension around money. It is not needed to form a household, so it comes after Stories 1–3.

**Independent Test**: In a household with two or more members, edit the weights as an admin and check the percentages shown to every member; add a member and check that the review banner appears and disappears after saving.

**Acceptance Scenarios**:

1. **Given** any member, **When** they open the "Split" section, **Then** they see every member with their weight and the resulting percentage of the total.
2. **Given** an ADMIN, **When** they set weights (whole numbers from 0 to 100) with at least one weight above 0 and save, **Then** the new weights and percentages are shown to everyone.
3. **Given** an ADMIN, **When** they try to save weights outside 0–100, non-whole numbers, or all zeros, **Then** nothing is saved and they see a friendly explanation.
4. **Given** a MEMBER or GUEST, **When** they try to change weights (from any client), **Then** the request is rejected.
5. **Given** that members joined or left after the last time the split was saved, **When** an ADMIN opens the "Split" section, **Then** they see a banner asking them to review the split; **When** they save the split, **Then** the banner disappears.

---

### Edge Cases

- A person opens an invitation link for the household they already belong to: the page tells them they are already a member and takes them to the household; the invitation is not used up.
- The admin who created a pending invitation leaves, is removed or is demoted: the invitation stays valid and still shows who created it.
- A user tries to join while their own household deletion or leave is in progress in another tab: the second action sees the up-to-date state and either succeeds or explains why not.
- An invitation link is tampered with or made up: it is treated like an invalid link (same kind explanation), without revealing whether a household exists.
- Every member except GUESTs (weight 0) leaves, leaving all weights at 0: the review banner is shown so an admin can fix the split.
- Two admins edit weights at the same time: the last save wins, and each sees the saved values after refreshing.
- A role change between MEMBER and GUEST does not change the person's weight; admins adjust it in the split if needed.
- A name made only of spaces counts as empty.

## Requirements _(mandatory)_

### Functional Requirements

**Households**

- **FR-001**: A signed-in user without a household MUST be able to create one by giving a name of 1 to 50 characters (surrounding spaces ignored).
- **FR-002**: The creator MUST become the household's only member, with role ADMIN and weight 1.
- **FR-003**: A user MUST NOT belong to more than one household at a time; any attempt to create or join a second one MUST be rejected.
- **FR-004**: ADMINs MUST be able to rename the household with the same name rules.
- **FR-005**: The no-household home page MUST offer "Create a household" and explain how to join with an invitation (replacing the current "Coming soon" state).

**Invitations**

- **FR-006**: Only ADMINs MUST be able to create invitations, each granting either MEMBER or GUEST.
- **FR-007**: Each invitation MUST be a shareable link that works once, expires 12 hours after creation, and can be revoked by any ADMIN of the household.
- **FR-008**: Invitation secrets MUST never be stored in readable form; a link MUST be impossible to guess.
- **FR-009**: ADMINs MUST see the household's pending invitations with role, creator and time remaining, and be able to copy a pending link, revoke it, or create a new link with the same role from an expired one in a single action.
- **FR-010**: A household MUST NOT have more than 10 pending (unused, unrevoked, unexpired) invitations at once.
- **FR-011**: Opening an invitation while signed out MUST lead through sign-in and back to the same invitation.
- **FR-012**: The invitation page MUST show the household name, the inviter's name and the role, and MUST require an explicit "Join" action.
- **FR-013**: Joining MUST add the person with the invitation's role and a default weight of 1 for MEMBER or 0 for GUEST, and MUST use up the invitation, even when two people try at the same time (only one succeeds).
- **FR-014**: If the person already belongs to a household, the invitation page MUST explain it, offer to leave the current household, and leave the invitation untouched.
- **FR-015**: Used, expired, revoked, unknown or tampered links MUST show a kind explanation and suggest asking for a new link, without revealing details about the household beyond what a valid link would.

**Members and roles**

- **FR-016**: A household MAY have several ADMINs.
- **FR-017**: ADMINs MUST be able to change any member's role to ADMIN, MEMBER or GUEST and remove any member, including other ADMINs.
- **FR-018**: Any member MUST be able to leave the household after confirming.
- **FR-019**: Any change (leave, remove, role change) that would leave a household with members but no ADMIN MUST be rejected with an explanation.
- **FR-020**: When the last member leaves, the household and its pending invitations MUST be deleted.
- **FR-021**: A person who was removed MUST see, the next time they open the app, the no-household screen with a gentle note naming the household they are no longer part of; the note MUST be shown once.
- **FR-022**: MEMBERs and GUESTs MUST be able to see the household's members and roles; only ADMINs see pending invitations.

**Default split**

- **FR-023**: Each member MUST have a whole-number weight from 0 to 100.
- **FR-024**: Every member MUST be able to see each member's weight and resulting percentage of the total weight.
- **FR-025**: Only ADMINs MUST be able to change weights; a save MUST be rejected unless every weight is a whole number from 0 to 100 and at least one is above 0.
- **FR-026**: When members join or leave after the split was last saved (or it was never saved), ADMINs MUST see a banner in the split section asking them to review it, which MUST disappear once they save the split.
- **FR-027**: Role changes MUST NOT change a member's weight.

**Access and quality (from the constitution)**

- **FR-028**: Every household action MUST be authorized by membership and role no matter how it is attempted (hiding a button is not enough); people from other households MUST get no access to a household's data, members or invitations.
- **FR-029**: All user-facing text, including error messages, MUST be available in English and Spanish in the person's chosen language.
- **FR-030**: All new screens MUST follow the design guide (warm tone, light and dark themes, AA contrast, keyboard accessible, color never the only signal).

### Key Entities

- **Household**: a shared home. Has a name. Contains members and pending invitations. Exists while it has at least one member.
- **Membership**: a person's place in a household. Links one user to one household, with a role (ADMIN, MEMBER or GUEST), a weight (0–100) and when they joined. A user has at most one.
- **Invitation**: a single-use, time-limited way into a household. Records the household, the role it grants, who created it, when it expires, and whether it was used (and by whom) or revoked. Its secret is never stored in readable form.
- **Split review state**: per household, when the split was last saved, so the system can tell whether members changed since.
- **Removal notice**: a one-time note for a person who was removed, naming the household.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new user can go from signing in to having their own household in under 1 minute.
- **SC-002**: An invited person can go from opening the link to being inside the household in under 2 minutes, including sign-in.
- **SC-003**: In acceptance tests, 100 % of attempts that would leave a household with members but no admin are refused.
- **SC-004**: In acceptance tests, 100 % of actions attempted by a role without permission, or by someone from another household, are refused without exposing the household's data.
- **SC-005**: A used, expired or revoked link never lets anyone in (0 successful joins in tests), and two simultaneous accepts of one link produce exactly one new member.
- **SC-006**: The percentages shown in the split always correspond to the saved weights (each rounded to the nearest whole percent) for every member who views them.
- **SC-007**: Every screen of the feature works in English and Spanish, in light and dark themes, and passes automated accessibility checks.

## Assumptions

- Sign-in with Google already exists and is reused; the invitation flow only needs to return the visitor to the invitation after sign-in.
- Data refreshes when people navigate or come back to the app; seeing other people's changes instantly is a later real-time feature.
- Invitations are only shared as links by the admin; the app sends no emails.
- There is no household type; one model covers couples, families and flatmates (constitution v2.0.0, ADR 0003).
- Household names need not be unique.
- Deleting a household explicitly, and rules about leaving with money owed, are decided with the expenses feature; until then nothing financial depends on membership.
- Percentages are shown rounded to whole numbers; exact cent splitting is defined with expenses.
- The removal notice is shown on the person's next visit on any device and then discarded.
