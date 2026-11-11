# Feature Specification: Expense categories with their own split

**Feature Branch**: `feat/expense-categories`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Expenses can have categories, so people can tell their expenses apart. Categories are managed in the household settings, together with the weights each one uses: if a box is ticked, that category's weights can be edited on their own; otherwise it takes the household's default." Settled in a design interview before writing: the household's weights stay the default and a category only has its own per-member weights when its box is ticked; every household starts with a starter set and admins can add, rename and delete categories; a category is optional on an expense; deleting a category leaves its expenses without one and never changes their shares; only admins manage categories and weights; someone who joins gets the household's joining weight in every category with its own weights; changing an expense's category asks, with a before and after per person, whether to apply the new category's split or keep the current shares; categories have a name and an optional emoji, show on every expense and can be used to filter the list. Charts and totals per category are left for a later feature.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Say what an expense was for (Priority: P1)

Ana adds the week's groceries (€42.80) and picks "🛒 Groceries" from the household's categories. Bruno later adds a coffee and leaves the category empty, because he is in a hurry. Both expenses appear in the list; the groceries one shows its category, and the coffee simply shows none.

**Why this priority**: Telling expenses apart is the purpose of the feature, and everything else (own splits, filtering) builds on an expense having a category. On its own it already makes the history easier to read.

**Independent Test**: In a new household, add one expense with a category from the starter set and one without, and check that both are saved, that the first shows its category in the list and in its detail, and that the second shows no category and is split exactly as it would be today.

**Acceptance Scenarios**:

1. **Given** a household that was just created, **When** anyone opens the expense form or the household settings, **Then** a starter set of categories is already there (Rent, Groceries, Utilities, Leisure and Other, each with an emoji), named in the language of the person who created the household.
2. **Given** a MEMBER or ADMIN adding an expense, **When** they pick one of the household's categories and save, **Then** the expense is saved with that category, and everyone sees the category's emoji and name on it in the expense list and in its detail.
3. **Given** a MEMBER or ADMIN adding an expense, **When** they leave the category empty and save, **Then** the expense is saved without a category, it is split with the household's weights exactly as before this feature, and nothing marks it as incomplete.
4. **Given** a household that existed before this feature, **When** its members open the app afterwards, **Then** it has the same starter set, and every earlier expense is unchanged and has no category.
5. **Given** a MEMBER or ADMIN editing an expense that uses "equally" or "exact amounts", **When** they add, change or remove its category, **Then** only the category changes; every person's share stays the same.
6. **Given** a GUEST, **When** they open the expenses, **Then** they see each expense's category but cannot set or change it (from any client).

---

### User Story 2 - Make the categories fit the home (Priority: P2)

Ana, an admin, opens the household settings. The home has no use for "Leisure", but it does have a dog, so she deletes one and adds "🐶 Dog". She also renames "Utilities" to "Bills". Everyone sees the new list the next time they add an expense.

**Why this priority**: A starter set never fits every home; a list people cannot adapt ends up ignored. It depends on Story 1.

**Independent Test**: As an admin, add a category, rename another and delete a third that already has expenses; check that the expense form offers the updated list, that renamed expenses show the new name, that the expenses of the deleted one have no category and the same shares as before, and that a member and a guest can see the list but not change it.

**Acceptance Scenarios**:

1. **Given** an ADMIN in the household settings, **When** they add a category with a name and, optionally, one emoji, **Then** it is saved and offered in the expense form to everyone.
2. **Given** an ADMIN, **When** they rename a category or change its emoji, **Then** every expense in that category shows the new name and emoji, and no share changes.
3. **Given** an ADMIN, **When** they submit an empty name, a name longer than 30 characters, or a name another category of the household already has (ignoring upper and lower case and surrounding spaces), **Then** nothing is saved and they see a friendly explanation next to the field.
4. **Given** a category used by 12 expenses, **When** an ADMIN chooses to delete it, **Then** a confirmation names the category and says that 12 expenses will be left without a category and that nobody's share will change; **When** they confirm, **Then** the category is gone, those expenses have no category, and every share and balance is exactly as before.
5. **Given** a household that already has 30 categories, **When** an ADMIN tries to add another, **Then** it is refused with an explanation that the limit was reached.
6. **Given** a MEMBER or a GUEST, **When** they open the household settings, **Then** they see every category and how it is split, without any way to change them; **When** they try to add, change or delete a category from any client, **Then** the request is rejected.
7. **Given** an ADMIN who deleted every category, **When** anyone adds an expense, **Then** the form works without offering a category, and the settings invite admins to add one.

---

### User Story 3 - Give a category its own split (Priority: P3)

Ana earns more than Bruno, so the household's weights are 3 and 1. But they agreed that rent is half each. Ana opens "🏠 Rent" in the settings, ticks "Use its own split" and sets both weights to 1. From then on, a rent expense is split 50/50 by default, while groceries and everything else keep following the household's 75/25.

**Why this priority**: This is what makes categories more than labels: one home, different agreements for different kinds of spending, without entering exact amounts every month. It depends on Stories 1 and 2.

**Independent Test**: In a household with weights 3 and 1, give one category its own weights of 1 and 1; add an expense in that category and one in another category with the default split, and check that the first is split in halves and the second 75/25; then change the household's weights and check that only the category without its own split follows them.

**Acceptance Scenarios**:

1. **Given** an ADMIN looking at a category in the settings, **When** its "use its own split" box is not ticked, **Then** the category shows the household's split (each member's percentage) as the one it follows, and its weights cannot be edited there.
2. **Given** an ADMIN, **When** they tick the box, **Then** the category gets one weight per current member, starting as a copy of the household's weights, each editable from 0 to 100 with the resulting percentage next to it.
3. **Given** "Rent" with its own weights of 1 and 1 in a household whose weights are 3 and 1, **When** someone adds a €900.00 expense in "Rent" with the default split, **Then** the form shows a 50 % / 50 % split named after the category before saving, and the saved shares are €450.00 each.
4. **Given** the same household, **When** someone adds an expense in a category whose box is not ticked, or with no category, **Then** the default split is the household's 75 % / 25 %.
5. **Given** a category whose box is not ticked, **When** an admin changes the household's weights, **Then** new expenses in that category use the new weights; a category with its own weights is not affected.
6. **Given** a category with its own weights, **When** an ADMIN unticks the box and confirms, **Then** the category follows the household's split again and its own weights are discarded; ticking the box later starts again from a copy of the household's weights.
7. **Given** expenses already saved in a category, **When** an admin ticks or unticks its box or changes its weights, **Then** none of those expenses change; only expenses saved afterwards use the new split.
8. **Given** a category whose own weights are all 0, **When** someone adds an expense in it, **Then** the default split is not offered for that expense, they are asked to choose who shares it, and they see a pointer to the category's settings.
9. **Given** "Rent" with its own weights for Ana and Bruno, **When** Carla joins as a MEMBER (or as a GUEST), **Then** she gets weight 1 (or 0) in "Rent", the same as in the household, and the settings show admins a notice on "Rent" asking them to review its split because the members changed.
10. **Given** a category with its own weights, **When** a member leaves or is removed, **Then** their weight disappears from it and the remaining members keep their proportions.
11. **Given** a MEMBER or a GUEST, **When** they try to tick the box or change a category's weights from any client, **Then** the request is rejected.

---

### User Story 4 - Move an expense to another category (Priority: P4)

Bruno recorded this month's €900.00 rent under "Groceries" by mistake, so it was split 75/25. He edits it and picks "Rent". Before saving, the form tells him that the shares would change ("Ana's part goes from €675.00 to €450.00, Bruno's from €225.00 to €450.00") and lets him choose between applying Rent's split, which is already selected, and keeping the shares as they are. He saves, and the balances follow.

Months later, Ana tidies the history and moves old expenses without a category into "Bills". For those she chooses to keep the shares, so nobody's balance moves.

**Why this priority**: It is the only place where a label can move money, so it must be explicit and visible. It only matters once categories can have their own split (Story 3).

**Independent Test**: With an expense saved with the default split, change its category to one that would split it differently; check that the form shows each person's share before and after and both choices, that applying the new split changes shares and balances to the previewed figures, and that keeping the shares changes only the category.

**Acceptance Scenarios**:

1. **Given** an expense saved with the default split, **When** someone changes its category (to another one, to none, or from none to one) and the new category's current split would give different shares, **Then** before saving the form shows each person's share before and after, and two choices: apply the new category's split (selected by default) or keep the current shares.
2. **Given** that choice, **When** they apply the new category's split and save, **Then** the shares become exactly the previewed ones, they add up to the amount, and everyone's balances reflect them.
3. **Given** that choice, **When** they keep the current shares and save, **Then** only the category changes; every share and balance stays the same.
4. **Given** an expense saved with the default split, **When** someone changes its category and the new category's current split gives exactly the same shares, **Then** nothing is asked and only the category changes.
5. **Given** an expense saved with the default split, **When** someone moves it to a category whose own weights are all 0, **Then** the new category's split cannot be applied; they can keep the current shares or choose another way to split.
6. **Given** an expense whose category and shares were changed, **When** anyone opens it, **Then** it shows who changed it last and when, as with any other edit.

---

### User Story 5 - Find the expenses of one category (Priority: P5)

Bruno wants to see what the dog has cost lately. He filters the expense list by "🐶 Dog" and reads only those expenses. He can also filter by "No category" to find the ones nobody classified.

**Why this priority**: Being able to see a category on its own is what makes classifying worthwhile, but the feature is already useful without it. It depends on Story 1.

**Independent Test**: With expenses in two categories and some without one, filter by each category and by "No category", and check that each view lists exactly the matching expenses and that clearing the filter shows everything again.

**Acceptance Scenarios**:

1. **Given** the expense list, **When** anyone (guests included) filters by one category, **Then** only the expenses in that category are listed, in the usual order, and the filter in use is clearly shown.
2. **Given** the expense list, **When** anyone filters by "No category", **Then** only expenses without a category are listed.
3. **Given** an active filter, **When** the person clears it, **Then** the whole history is shown again, payments included.
4. **Given** a filter with no matching expenses, **When** the list is shown, **Then** it explains in a friendly way that there are no expenses in that category yet, instead of an empty list.
5. **Given** an active filter, **When** the person looks at the balances, **Then** they are the same as without the filter: balances always count every expense and payment.

---

### Edge Cases

- A category deleted while someone has an expense form open with it selected: saving is refused with an explanation, the rest of what they typed is kept, and they choose again.
- Two admins editing the same category at once: the second save is refused with an explanation that it changed meanwhile, and they see the latest version before trying again.
- Editing an expense without touching its category keeps today's rule: an expense recorded with the default split keeps the proportions it was recorded with, and the form describes them as they were ("Rent's split when it was added: Ana 50 %, Bruno 50 %"), not as they are now.
- An expense whose shares were kept when it moved to another category shows the new category together with the proportions it was recorded with; its category alone does not imply its split.
- Switching an expense from "equally" or "exact amounts" to the default split uses the current split of its category (or the household's, if it has none or the category follows the household).
- A deleted category's name can be used again for a new category; the expenses of the old one stay without a category.
- Deleting a category with its own weights also discards those weights; the confirmation says so.
- A household of one can use categories and own weights; its balance is always all square.
- A member with weight 0 in the household can have a weight above 0 in a category, and the other way round.
- Former members have no weight in any category; expenses that include them keep them.
- Payments (settlements) have no category; while a category filter is active they are not listed.
- A deleted expense's line in the history is unaffected by anything that later happens to its category.
- Emoji are decorative: a category is always identified by its name, also for screen readers.

## Requirements _(mandatory)_

### Functional Requirements

**Categories**

- **FR-001**: Every household MUST have its own list of expense categories. A category MUST have a name of 1 to 30 characters (surrounding spaces ignored), unique within the household ignoring upper and lower case, and MAY have one emoji.
- **FR-002**: A new household MUST start with a starter set of five categories (Rent, Groceries, Utilities, Leisure, Other), each with an emoji, named in the language of the person who creates the household. Households that already exist MUST receive the same set once, named in the language of their longest-standing admin. After that, starter categories are ordinary categories: they can be renamed and deleted like any other.
- **FR-003**: ADMINs MUST be able to add, rename, change the emoji of and delete categories from the household settings. A household MUST NOT have more than 30 categories and MAY have none.
- **FR-004**: Everyone in the household, guests included, MUST be able to see the list of categories and how each one is split.
- **FR-005**: Categories MUST be listed everywhere in the same order: the order in which they were added.

**Categories on expenses**

- **FR-006**: MEMBERs and ADMINs MUST be able to give an expense one category from the household's list when adding or editing it, and to leave it without one. An expense without a category MUST be treated as complete and normal.
- **FR-007**: Every expense with a category MUST show the category's emoji and name in the expense list and in its detail.
- **FR-008**: Renaming a category or changing its emoji MUST show on all of its expenses and MUST NOT change any share.
- **FR-009**: Deleting a category MUST require a confirmation that names it, says how many expenses will be left without a category and says that no share will change. After deletion those expenses MUST have no category, and every share and balance MUST be exactly as before.
- **FR-010**: Expenses that existed before this feature MUST keep their shares and have no category.

**A category's own split**

- **FR-011**: Each category MUST either follow the household's split or use its own, chosen by ADMINs with a single box in the household settings. Categories follow the household's split unless the box is ticked.
- **FR-012**: A category that follows the household's split MUST always use the household's current weights, including after those weights change.
- **FR-013**: When the box is ticked, the category MUST get one whole-number weight from 0 to 100 per current member, starting as a copy of the household's weights. ADMINs MUST be able to edit them, and the resulting percentage MUST be shown next to each weight.
- **FR-014**: When the box is unticked, after a confirmation, the category MUST follow the household's split again and its own weights MUST be discarded.
- **FR-015**: The default split of a new expense MUST be proportional to the weights of its category when that category uses its own split, and to the household's weights otherwise (no category, or a category that follows the household). The form MUST show which split applies and each person's percentage before saving, and MUST update it when the category is changed.
- **FR-016**: Every rule that already applies to the default split MUST apply to a category's own split: members with weight 0 get no share, shares add up exactly to the amount, and leftover cents go one each to the people who come first in the household's member order.
- **FR-017**: When all of a category's own weights are 0, the default split MUST NOT be offered for an expense in that category; the person MUST choose another way to split and MUST see a pointer to the category's settings.
- **FR-018**: A person who joins the household MUST get, in every category with its own split, the same weight they get in the household on joining (1 for a MEMBER, 0 for a GUEST). When members have changed since a category's own weights were last edited, the settings MUST show admins a notice on that category asking them to review its split.
- **FR-019**: When a person leaves or is removed, their weight MUST disappear from every category; the remaining weights MUST NOT change.
- **FR-020**: Ticking or unticking the box, or changing a category's weights, MUST NOT change any expense that is already saved.

**Changing an expense's category**

- **FR-021**: Changing the category of an expense that is split "equally" or by "exact amounts" MUST NOT change its shares.
- **FR-022**: When the category of an expense saved with the default split is changed and the new category's current split would give different shares, the form MUST show each person's share before and after, and MUST offer two choices before saving: apply the new category's split (selected by default) or keep the current shares.
- **FR-023**: Applying the new category's split MUST save exactly the shares that were previewed; keeping the current shares MUST change only the category.
- **FR-024**: When the new category's current split gives the same shares the expense already has, the category MUST change without asking anything.
- **FR-025**: An expense's shares MUST still change only when someone edits that expense and sees the new shares before saving. No change to categories, to their weights or to the household's weights may change them otherwise.

**Finding expenses**

- **FR-026**: Everyone in the household MUST be able to filter the expense list by one category or by "No category", see which filter is in use, and clear it.
- **FR-027**: Filtering MUST NOT affect balances or suggested payments, which always count every expense and payment of the household.
- **FR-028**: A filter with no matching expenses MUST show a friendly explanation instead of an empty list.

**Access and quality (from the constitution)**

- **FR-029**: Only ADMINs MUST be able to add, change or delete categories and to change how they are split. MEMBERs MUST only be able to choose a category on expenses; GUESTs MUST only be able to read. Every action MUST be authorized by membership and role no matter how it is attempted, and people from other households MUST get no access to a household's categories.
- **FR-030**: A change to a category based on an outdated version of it MUST be refused with an explanation, so nobody overwrites a change they have not seen.
- **FR-031**: All new user-facing text, including error messages and the starter category names, MUST be available in English and Spanish. Category names typed by people are shown as typed.
- **FR-032**: All new and changed screens MUST follow the design guide (joyful and approachable tone, light and dark themes, AA contrast, keyboard accessible). A category MUST never be told apart by color or emoji alone: its name is always present.

### Key Entities

- **Category**: a kind of spending in one household ("Rent", "Dog"). Has a name, an optional emoji, its place in the household's list, and whether it follows the household's split or uses its own.
- **Category weight**: how much of a category's expenses one member takes on by default, a whole number from 0 to 100. Exists only for categories that use their own split, one per current member.
- **Household split**: the members' weights from the households feature. It is the default for expenses without a category and for every category that does not use its own split.
- **Expense** (existing): gains an optional category. Its shares remain fixed when it is saved and only change when it is edited.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A member can record an everyday expense with a category in under 30 seconds, and without a category in the same time as before this feature.
- **SC-002**: An admin can give a category its own split in under one minute from opening the household settings.
- **SC-003**: In acceptance tests, 100 % of expenses split with a category's own weights have shares that add up exactly to their amount, including amounts that cannot be divided evenly (0 cents of difference).
- **SC-004**: In acceptance tests, renaming or deleting a category, ticking or unticking its box, and changing its weights or the household's change 0 shares and 0 balances of expenses that are already saved.
- **SC-005**: In acceptance tests, every change of category that would alter someone's share shows each person's share before and after, and the saved shares match the preview to the cent.
- **SC-006**: A member can list the expenses of one category in at most two actions from the expense list.
- **SC-007**: In acceptance tests, 100 % of attempts by a MEMBER or GUEST to manage categories or their split, and by a GUEST or someone from another household to categorize an expense, are refused.
- **SC-008**: Every screen of the feature works in English and Spanish, in light and dark themes, and passes automated accessibility checks.

## Assumptions

- The households and expenses features are in place: roles, member weights (0–100), member order by join date, the three ways to split, fixed shares, balances and the history.
- **The constitution must be amended before planning.** Its MVP scope does not list expense categories, and Principle II defines the default split as coming only from the members' household weights. Both need an amendment in its own change, and a new decision record that extends `0003-proportional-split-by-weight`. The expenses spec (002) listed categories as out of scope; this feature replaces that statement.
- Charts and totals per category are out of scope here and belong to the later budgets and charts phase (v1.2). This feature only makes sure every expense can carry the category they will need.
- An expense has at most one category. Sub-categories, several categories per expense, colors per category, reordering categories by hand, archiving or restoring deleted categories, and categories on payments are out of scope.
- The starter set is created once per household and is never added back: if an admin deletes a starter category, it stays deleted.
- 30 categories per household and 30 characters per name are sanity limits, not business rules.
- "One emoji" means one emoji as people perceive it (including combined ones such as flags or skin tones).
- The list filter takes one choice at a time; combining categories or adding other filters (dates, people) is out of scope.
- Data refreshes when people navigate or come back to the app; seeing other people's changes instantly is the later real-time feature.
