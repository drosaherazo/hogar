# Feature Specification: Expenses with splits, balances and settling up

**Feature Branch**: `feat/expenses`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Expenses with splits, balances and settling up, inside the household." Full input: members record shared expenses (description, amount in euros, who paid, date) and how each one is split: by default proportional to the household's weights from the households feature; alternatively equally among the people chosen, or with exact amounts per person. Every split adds up exactly to the total, to the cent. Everyone in the household sees balances: who owes whom, phrased warmly ("Ana owes you €12.50" / "Ana te debe 12,50 €"), simplified to the fewest payments needed to settle. Anyone can record a settlement (a payment from one member to another) to settle up, and balances update. Members and admins can add, edit and delete expenses; guests only read. Why: money between people who live together is the main source of tension this app exists to lower; balances must be exact, transparent and never disagree between people. Real-time updates are a later feature. Settle the points the households spec deferred: leaving or being removed with an open balance, how expenses involving people who left are shown, and whether the last member can delete a household that still has expenses.

## Clarifications

### Session 2026-11-11

- Q: Is leaving or removal allowed while the person still owes or is owed money? → A: Yes, after a confirmation that states the open balance; it stays in the balances under the former member's name until settled (FR-026, FR-027).
- Q: Who may edit and delete expenses and payments? → A: Any MEMBER or ADMIN, on any record, whoever recorded it; every record shows who recorded it and who last changed it (FR-022, FR-023).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a shared expense (Priority: P1)

Ana buys the week's groceries for €42.80. She adds an expense ("Groceries", €42.80, paid by Ana, today). It uses the household's default split (Ana 75 %, Bruno 25 %), so Bruno's share is €10.70 and Ana's €32.10. Both of them see it at the top of the expense list.

**Why this priority**: Recording what was spent, and for whom, is the base of everything else; balances and settling up only make sense once expenses exist.

**Independent Test**: In a household with two members and weights 3 and 1, add an expense as a member and check that it appears for both with the right payer, amount, date and shares, and that each person sees their own part.

**Acceptance Scenarios**:

1. **Given** a MEMBER or ADMIN, **When** they add an expense with a description, an amount, the person who paid and a date, **Then** it is saved with the household's default split and appears first in everyone's expense list, showing what it was, the amount, who paid, the date and the viewer's own part ("You owe €10.70" / "You lent €10.70").
2. **Given** weights of 3 and 1, **When** an expense of €10.01 is added with the default split, **Then** the shares are €7.51 and €2.50: they add up exactly to the total, and the leftover cent goes to the member who comes first in the household.
3. **Given** a MEMBER or ADMIN, **When** they submit an empty description, an amount of zero or less, an amount with more than two decimals, or a date in the future, **Then** nothing is saved and they see a friendly explanation next to the field.
4. **Given** a GUEST, **When** they try to add an expense (from any client), **Then** the request is rejected.
5. **Given** a household where every weight is 0, **When** a member adds an expense, **Then** the default split is not offered, they are asked to choose who shares it, and they see a pointer to the household's split settings.
6. **Given** an expense saved with the default split, **When** an admin later changes the weights, **Then** the shares of that expense do not change; only new expenses use the new weights.

---

### User Story 2 - See who owes whom (Priority: P2)

Bruno opens the household and reads "You owe Ana €10.70". Ana sees "Bruno owes you €10.70". When everything is settled, both see "All square! Nobody owes anything."

**Why this priority**: Knowing where everyone stands, in plain words and with the same figures for everyone, is what removes the awkward "how much do I owe you?" conversations. It depends on Story 1.

**Independent Test**: Record a few expenses with different payers among three members and check that every member sees the same balances, that they add up to zero, and that the suggested payments would leave everyone at zero.

**Acceptance Scenarios**:

1. **Given** a household with expenses, **When** any member (guests included) opens the balances, **Then** they see each person's overall balance in words ("Ana is owed €20.00", "Carla owes €20.00") and a short list of suggested payments that would settle everyone.
2. **Given** suggested payments that involve the viewer, **When** they read them, **Then** they are phrased from the viewer's point of view ("You owe Ana €10.70", "Bruno owes you €10.70").
3. **Given** Ana paid €20.00 for Bruno only and Bruno paid €20.00 for Carla only, **When** anyone opens the balances, **Then** Bruno is all square and the only suggested payment is €20.00 from Carla to Ana (one payment instead of two).
4. **Given** every balance is zero, **When** anyone opens the balances, **Then** they see a friendly "all square" message instead of an empty list.
5. **Given** any member, **When** they open the household home, **Then** they see their own overall balance in one sentence ("You owe €10.70 in total", "You're owed €10.70 in total" or "You're all square") and a way into expenses and balances.

---

### User Story 3 - Settle up (Priority: P3)

Bruno sends Ana €10.70 by bank transfer. In the balances he chooses the suggested payment "You owe Ana €10.70", confirms that he paid it, and both of them now see "All square!". The payment appears in the history.

**Why this priority**: Without a way to record repayments, balances only grow and stop reflecting reality. It depends on Story 2.

**Independent Test**: With an open balance between two members, record the suggested payment and check that both balances return to zero and that the payment appears in the history.

**Acceptance Scenarios**:

1. **Given** a suggested payment, **When** a MEMBER or ADMIN chooses to record it, **Then** a form opens with who pays, who receives and the amount already filled in; **When** they confirm, **Then** the payment is saved and everyone's balances reflect it.
2. **Given** a MEMBER or ADMIN, **When** they record a payment between any two different people of the household for any amount from €0.01, **Then** it is saved, including partial payments.
3. **Given** the settlement form, **When** the amount is larger than what is currently owed between the two people, **Then** the form explains that the balance will reverse (who owes whom) and still allows saving.
4. **Given** the same person as payer and receiver, an amount of zero or less, or a date in the future, **When** they try to save, **Then** nothing is saved and they see a friendly explanation.
5. **Given** a GUEST, **When** they try to record a payment (from any client), **Then** the request is rejected.
6. **Given** recorded payments, **When** anyone browses the history, **Then** payments appear alongside expenses, in date order ("Bruno paid Ana €10.70").

---

### User Story 4 - Split an expense differently (Priority: P4)

Ana and Bruno go out for dinner without Carla, so Ana splits that €35.00 expense equally between the two of them. Another day Bruno pays a €50.00 bill where €30.00 was his own and €20.00 was Carla's, so he enters those exact amounts.

**Why this priority**: The default split covers shared household costs; real life also has expenses that only involve some people or have uneven parts. It builds on Story 1.

**Independent Test**: Add one expense split equally among some members and one with exact amounts, and check each person's share and the resulting balances.

**Acceptance Scenarios**:

1. **Given** the expense form, **When** the person chooses "equally" and picks the people who share it (at least one), **Then** each gets an equal share and leftover cents go to those who come first in the household (€10.00 among three gives €3.34, €3.33 and €3.33).
2. **Given** the expense form, **When** the person chooses "exact amounts", **Then** they enter an amount for each person, see how much is still left to assign (or how much over the total they are), and can only save once the amounts add up exactly to the total.
3. **Given** an expense that only involves other people (Ana pays for something that is only Bruno's), **When** it is saved, **Then** the payer has no share and the whole amount counts as owed to them.
4. **Given** the expense form, **When** the person chooses who shares the expense, **Then** any current member can be chosen, including guests and members whose weight is 0.
5. **Given** any expense, **When** someone opens it, **Then** they see how it was split and every person's share.

---

### User Story 5 - Fix mistakes (Priority: P5)

Bruno typed €4.20 instead of €42.00 for the electricity bill. He opens the expense, corrects the amount, and the balances update. Later Ana notices a payment recorded twice and deletes one of them.

**Why this priority**: Mistakes with shared money cause friction if they can't be fixed openly; showing who changed what keeps everyone's trust. It builds on Stories 1 and 3.

**Independent Test**: Edit an expense's amount and split, delete another one and a settlement, and check that balances follow each change and that each record shows who recorded and last changed it.

**Acceptance Scenarios**:

1. **Given** an expense or payment recorded by anyone, **When** a MEMBER or ADMIN changes any of its details (including the split) and saves, **Then** the change is saved and everyone's balances reflect it.
2. **Given** an expense or payment recorded by anyone, **When** a MEMBER or ADMIN deletes it and confirms in a dialog that names it ("Delete 'Groceries' (€42.80)?"), **Then** it disappears from the history and the balances.
3. **Given** any expense or payment, **When** someone opens it, **Then** they see who recorded it and, if it was changed, who changed it last and when.
4. **Given** two people editing the same expense, **When** the second one saves after the first, **Then** the second save is refused with an explanation that it changed meanwhile, and they see the latest version before trying again.
5. **Given** a GUEST, **When** they try to edit or delete (from any client), **Then** the request is rejected.

---

### User Story 6 - People move out without losing the history (Priority: P6)

Carla moves out while she still owes Ana €15.00. Her expenses stay in the history under her name, marked as a former member, and her €15.00 still appears in the balances until Ana records that Carla paid her back.

**Why this priority**: People move in and out; history and balances must stay honest when they do. It settles what the households feature left open, and it builds on Stories 1–3.

**Independent Test**: With a member who has an open balance, have them leave; check that the history and balances still show them as a former member, that a payment with them can be recorded, and that they cannot be added to new expenses.

**Acceptance Scenarios**:

1. **Given** a member with a non-zero balance, **When** they choose to leave or an admin chooses to remove them, **Then** the confirmation states the open balance in words ("You still owe €15.00 in total" / "Carla still owes €15.00 in total") and explains that it will stay in the balances until it is settled; **When** they confirm, **Then** the person is no longer a member and their balance keeps counting as a former member's.
2. **Given** a former member, **When** anyone browses the history or the balances, **Then** the former member appears by name with a "former member" mark, and their open balance still counts in the balances and suggested payments until it is settled.
3. **Given** a former member with an open balance, **When** a MEMBER or ADMIN records a payment between them and someone in the household, **Then** it is saved and balances update.
4. **Given** the expense form, **When** someone chooses the payer or who shares a new expense, **Then** former members are not offered; existing expenses that include them keep them.
5. **Given** a former member who rejoins the same household with a new invitation, **When** they open the expenses, **Then** their earlier expenses, payments and balance are theirs again.
6. **Given** the last member of a household that has expenses or payments, **When** they choose to leave, **Then** the confirmation warns that the household and all its expenses and payments will be deleted; **When** they confirm, **Then** everything is deleted.
7. **Given** a person who left or was removed, **When** they try to see the household's expenses, payments or balances (from any client), **Then** they get no access.

---

### Edge Cases

- A household of one can record expenses; its balance is always all square, and no payments are suggested.
- An amount smaller than the number of people sharing it (€0.02 among three) gives some people a share of €0.00; the shares still add up to the total.
- With exact amounts, a person given €0.00 does not share the expense.
- An expense paid by someone for themselves only does not change any balance; it stays in the history.
- Editing an expense recorded with the default split keeps its saved shares unless the amount or the way of splitting changes; then the shares are recalculated with the current weights and shown before saving.
- A member whose role changes between MEMBER and GUEST keeps their place in past expenses and balances, and can still be chosen to share or pay new expenses.
- People who joined after an expense's date can still be included in it; dates are informational and do not limit who can share.
- Amounts are typed with the decimal separator of the person's language ("12.50" in English, "12,50" in Spanish).
- The same payment recorded twice by mistake can be fixed by deleting one of them; balances follow.
- A suggested payment can disappear or change between opening the balances and confirming (someone else recorded an expense meanwhile); the form keeps what the person entered, and the saved payment counts as entered.

## Requirements _(mandatory)_

### Functional Requirements

**Expenses**

- **FR-001**: MEMBERs and ADMINs MUST be able to record an expense with a description of 1 to 100 characters (surrounding spaces ignored), an amount in euros from €0.01 to €100,000.00 with at most two decimals, the member who paid, and a date that defaults to today and cannot be in the future.
- **FR-002**: The payer MUST be a current member of the household, of any role.
- **FR-003**: Everyone in the household MUST be able to browse all expenses and payments, most recent date first, each showing what it was, the amount, who paid, the date and the viewer's own part.
- **FR-004**: Everyone MUST be able to open an expense and see how it was split and every person's share.

**Splits**

- **FR-005**: By default an expense MUST be split proportionally to the members' weights at the moment it is saved; members with weight 0 get no share.
- **FR-006**: An expense MUST also be splittable equally among people chosen from the current members (at least one), or by an exact amount per person.
- **FR-007**: The shares of every expense MUST add up exactly to its amount. When an amount cannot be divided exactly, the leftover cents MUST go one each to the people who come first in the household's member order (the order in which they joined).
- **FR-008**: With exact amounts, saving MUST be impossible until the amounts add up to the total, and the form MUST show how much is left to assign or how much it exceeds the total.
- **FR-009**: Shares MUST be fixed when an expense is saved: later changes to weights or members MUST NOT change existing expenses.
- **FR-010**: When every weight in the household is 0, the default split MUST NOT be offered; the person MUST choose another way to split and MUST see a pointer to the household's split settings.
- **FR-011**: The payer MUST NOT be required to share the expense.

**Balances**

- **FR-012**: Each person's balance MUST equal what they paid in expenses, minus their shares of expenses, plus the payments they made to others, minus the payments they received, exact to the cent and based on every expense and payment of the household.
- **FR-013**: The balances of everyone in the household's history (former members included) MUST always add up to exactly zero, and every member MUST see the same figures.
- **FR-014**: Balances MUST be shown in words ("Ana is owed €20.00", "Carla owes €20.00"), never with a plus or minus sign alone.
- **FR-015**: The system MUST suggest payments that would settle every balance, using at most one fewer payment than there are people with a non-zero balance, and never asking anyone to both pay and receive.
- **FR-016**: Suggested payments that involve the viewer MUST be phrased from their point of view ("You owe Ana €10.70", "Bruno owes you €10.70").
- **FR-017**: The household home MUST show the viewer's overall balance in one sentence and lead to the expenses and balances; when it is zero, it MUST show a friendly "all square" message.

**Settling up**

- **FR-018**: MEMBERs and ADMINs MUST be able to record a payment between two different people of the household (current or former members) with an amount from €0.01 to €100,000.00 with at most two decimals and a date that defaults to today and cannot be in the future.
- **FR-019**: Choosing a suggested payment MUST open the payment form with the payer, the receiver and the amount already filled in.
- **FR-020**: Before saving, the payment form MUST show what is currently owed between the two people; a larger amount MUST be allowed, with an explanation that the balance will reverse.
- **FR-021**: Payments MUST appear in the history alongside expenses ("Bruno paid Ana €10.70").

**Fixing mistakes**

- **FR-022**: MEMBERs and ADMINs MUST be able to change any detail of any expense or payment (including the split), whoever recorded it, and to delete it after a confirmation that names it.
- **FR-023**: Every expense and payment MUST show who recorded it and, if it was changed, who changed it last and when.
- **FR-024**: A change based on an outdated version of an expense or payment MUST be refused with an explanation, so nobody overwrites a change they have not seen.
- **FR-025**: Editing or deleting MUST update everyone's balances.

**People who move out (deferred from households)**

- **FR-026**: A person who still owes or is owed money MUST be able to leave, and an admin MUST be able to remove them, after a confirmation that states their open balance in words and explains that it stays in the balances until it is settled.
- **FR-027**: People who left or were removed MUST remain in the history by name with a "former member" mark. Their open balance MUST keep counting in the balances and suggested payments until it is settled, and MEMBERs and ADMINs MUST be able to record payments with them.
- **FR-028**: Former members MUST NOT be offered as the payer or as someone who shares a new expense; existing expenses that include them MUST keep them.
- **FR-029**: A former member who rejoins the same household MUST get back their earlier expenses, payments and balance.
- **FR-030**: When the last member of a household leaves, the confirmation MUST warn that the household and all its expenses and payments will be deleted, and confirming MUST delete them.
- **FR-031**: People who left or were removed MUST NOT be able to see the household's expenses, payments or balances.

**Access and quality (from the constitution)**

- **FR-032**: GUESTs MUST be able to see every expense, payment and balance but MUST NOT be able to record, change or delete anything. Every action MUST be authorized by membership and role no matter how it is attempted, and people from other households MUST get no access to a household's expenses, payments or balances.
- **FR-033**: Amounts MUST always be in euros and shown with the person's language conventions (€12.50 / 12,50 €); dates MUST follow the same conventions.
- **FR-034**: All user-facing text, including error messages, MUST be available in English and Spanish in the person's chosen language.
- **FR-035**: All new screens MUST follow the design guide (warm tone, light and dark themes, AA contrast, keyboard accessible, color never the only signal).

### Key Entities

- **Expense**: money one person paid for the household. Has a description, an amount in euros, the person who paid, a date, how it was split (household split, equally among chosen people, or exact amounts), who recorded it and who last changed it.
- **Share**: one person's part of an expense, an exact amount. The shares of an expense add up to its amount and are fixed when it is saved.
- **Payment (settlement)**: money one person gave another to settle up. Has who paid, who received, an amount, a date, who recorded it and who last changed it.
- **Balance**: what a person is owed or owes overall in the household. Always derived from expenses and payments, never kept separately.
- **Suggested payment**: one transfer in the shortest list of transfers that would bring every balance to zero. Derived, never kept.
- **Former member**: a person who left or was removed but still appears in the household's history and balances.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A member can record an everyday expense with the default split in under 30 seconds.
- **SC-002**: In acceptance tests, 100 % of expenses have shares that add up exactly to their amount, including amounts that cannot be divided evenly (0 cents of difference).
- **SC-003**: In acceptance tests, the balances of a household always add up to exactly zero, and two members viewing them at the same time see identical figures.
- **SC-004**: Recording every suggested payment always leaves every balance at zero, using at most one fewer payment than the number of people with a non-zero balance.
- **SC-005**: From the household home, a member can tell whether they owe or are owed money, and how much, without any further step.
- **SC-006**: In acceptance tests, 100 % of actions attempted by a GUEST, a former member or someone from another household are refused without exposing the household's money data.
- **SC-007**: Every screen of the feature works in English and Spanish, in light and dark themes, and passes automated accessibility checks.

## Assumptions

- The households feature is in place: roles, member weights (0–100), member order by join date, and leaving and removing members.
- Data refreshes when people navigate or come back to the app; seeing other people's changes instantly is the later real-time feature.
- Money is always euros; multiple currencies, receipts or photos, categories, comments and notifications are out of scope. Recurring expenses (v1.1) and budgets and charts (v1.2) are later phases.
- Dates are calendar days without a time of day.
- "The fewest payments" means at most one fewer payment than the number of people with a non-zero balance, with nobody both paying and receiving; finding the absolute minimum in every unusual case is not required.
- €100,000.00 per expense or payment is a sanity limit against typing mistakes, not a business rule.
- Members can include guests in expenses and payments: a guest's weight of 0 only keeps them out of the default split, as the households feature describes ("doesn't pay by default").
- Payments are records of money that changed hands outside the app; the app moves no money.
- Deleting a household explicitly (without its members leaving) remains out of scope.
