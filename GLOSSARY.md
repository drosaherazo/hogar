# Hogar

The shared language of Hogar: a web app where the people who share a home (a couple, a family or flatmates) split expenses, share chores and keep one shopping list. Terms are written as the interface says them; where the code uses another name, it is given in brackets.

## Home and people

**Household**:
A shared home: a named group of people who split its expenses and chores. It exists only while it has at least one member.
_Avoid_: home, flat, group, house

**Member** (`Membership`):
A person's place in one household, with a role, a weight and the moment they joined. A person is a member of at most one household.
_Avoid_: flatmate, participant, user (when you mean someone's place in a household)

**Admin**:
A member who can do everything, including managing members, invitations, the household split and categories. A household always has at least one.
_Avoid_: owner, creator

**Guest**:
A member who can see everything and change nothing. Joins with weight 0.
_Avoid_: viewer, read-only member

**Invitation**:
A single-use link, valid for 12 hours, that lets one person join a household as a member or a guest.
_Avoid_: invite code, join link

**Former member**:
Someone who left or was removed from a household but still appears in its expenses, payments and balances.
_Avoid_: ex-member, deleted member

**Removal notice**:
The one-time message a person sees after being removed from a household, naming it.

## Splitting

**Weight**:
A whole number from 0 to 100 per member saying how much of the household's spending they take on by default, relative to the others. Weight 0 means they share nothing by default.
_Avoid_: percentage, ratio, share (a share is an amount of money)

**Household split**:
The members' weights taken together: the default way an expense is divided when it has no category, or when its category follows the household.
_Avoid_: default share, split ratio

**Split review**:
The notice asking admins to check the household split (or a category's own split) because members joined or left since it was last saved.

**Split method**:
How one expense was divided: by the **household split**, **equally** among chosen people, or with **exact amounts** per person.

## Money

**Expense**:
Money one person paid for the household, with a description, an amount, a date and how it is split. A deleted expense keeps its trace in the history but no longer counts.
_Avoid_: purchase, transaction, bill

**Share** (`ExpenseShare`):
One person's part of one expense, an exact amount in cents. The shares of an expense always add up to its amount and are fixed when it is saved.
_Avoid_: portion, part, quota

**Payment** (`Settlement`):
Money one person gave another to settle up. The interface says payment; the code says settlement.
_Avoid_: transfer, reimbursement, repayment

**Balance**:
What a person is owed (positive) or owes (negative) overall in a household, always computed from expenses and payments, never stored.
_Avoid_: debt, total

**Suggested payment**:
One transfer in the shortest list of payments that would bring every balance to zero. Computed, never stored.
_Avoid_: settlement plan, debt simplification (that is the algorithm, not the thing people see)

## Categories

**Category** (`ExpenseCategory`):
A kind of spending in one household ("Rent", "Dog"), with a name, an optional emoji and a place in the household's list. An expense has at most one.
_Avoid_: tag, label, type

**Own split**:
A category's choice to divide its expenses by its own weights instead of following the household split.
_Avoid_: custom split, override

**Category weight**:
A member's weight for one category that uses its own split. Exists for every current member while the category has its own split, and for nobody otherwise.

**Starter set**:
The five categories every household gets when it is created (Rent, Groceries, Utilities, Leisure, Other), named in the creator's language.
_Avoid_: default categories, presets

## Starting the app

**Wake-up screen**:
What people see while the server wakes from sleep: a short sequence of friendly stages and tips, then an offer to try again if it takes too long.
_Avoid_: loading screen, spinner, splash
