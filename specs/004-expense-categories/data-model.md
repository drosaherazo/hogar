# Data model: Expense categories

Changes to `apps/api/prisma/schema.prisma`, plus the SQL appended to the generated migration. Money rules are unchanged: shares stay in `expense_shares`, in integer cents, fixed at save time.

## New: `ExpenseCategory` (`expense_categories`)

| Field          | Type        | Rules                                                                                                     |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `id`           | `String`    | cuid (uuid for backfilled rows, R4)                                                                       |
| `householdId`  | `String`    | FK → `households.id`, `ON DELETE CASCADE`                                                                 |
| `name`         | `String`    | trimmed, 1–30 chars; unique per household ignoring case (expression index, R7)                            |
| `emoji`        | `String?`   | one emoji grapheme or null (validated by the shared schema)                                               |
| `position`     | `Int`       | `max + 1` within the household at creation; lists order by it (R8)                                        |
| `ownSplit`     | `Boolean`   | default `false`: the category follows the household's split                                               |
| `splitSavedAt` | `DateTime?` | last time an admin saved its own split; compared with `households.members_changed_at` for the notice (R5) |
| `version`      | `Int`       | default 1; bumped on every rename, emoji change and split save (R10)                                      |
| `createdAt`    | `DateTime`  | default now                                                                                               |

Relations: `household`, `weights CategoryWeight[]`, `expenses Expense[]`.

Indexes: `@@index([householdId, position])`; unique `(household_id, lower(name))` added in SQL.

## New: `CategoryWeight` (`category_weights`)

| Field          | Type     | Rules                                                               |
| -------------- | -------- | ------------------------------------------------------------------- |
| `categoryId`   | `String` | FK → `expense_categories.id`, `ON DELETE CASCADE`                   |
| `membershipId` | `String` | FK → `memberships.id`, `ON DELETE CASCADE` (leaving removes it, R1) |
| `weight`       | `Int`    | 0–100, `CHECK`                                                      |

Primary key `(categoryId, membershipId)`; `@@index([membershipId])`.

Invariant: a category has weight rows **if and only if** `ownSplit` is true, with exactly one row per current membership of its household. Kept by: the split endpoint replacing all rows (R6), joining inserting one (R5), and leaving cascading one away (R1).

## Changed: `Expense`

| Field        | Type      | Rules                                                                                                |
| ------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `categoryId` | `String?` | FK → `expense_categories.id`, `ON DELETE SET NULL`; must belong to the expense's household (service) |

New index `@@index([householdId, categoryId])` for the filter (R9). Existing rows get `NULL` (FR-010).

## Changed: `Household` and `Membership`

Back-relations only: `Household.categories ExpenseCategory[]`, `Membership.categoryWeights CategoryWeight[]`.

## Migration SQL appended to the generated file

```sql
ALTER TABLE "category_weights"
  ADD CONSTRAINT "category_weights_weight_range" CHECK ("weight" BETWEEN 0 AND 100);

CREATE UNIQUE INDEX "expense_categories_household_name_key"
  ON "expense_categories" ("household_id", lower("name"));

-- Starter set for households that already exist (FR-002), in the locale of the
-- longest-standing admin. Runs once, with the deploy.
INSERT INTO "expense_categories" ("id", "household_id", "name", "emoji", "position", "own_split", "version", "created_at")
SELECT gen_random_uuid()::text, h."id",
       CASE WHEN admin_locale.locale = 'es' THEN s.name_es ELSE s.name_en END,
       s.emoji, s.position, false, 1, now()
FROM "households" h
CROSS JOIN (VALUES
  (1, '🏠', 'Rent', 'Alquiler'),
  (2, '🛒', 'Groceries', 'Comida'),
  (3, '💡', 'Utilities', 'Suministros'),
  (4, '🎉', 'Leisure', 'Ocio'),
  (5, '📦', 'Other', 'Otros')
) AS s(position, emoji, name_en, name_es)
LEFT JOIN LATERAL (
  SELECT u."locale" FROM "memberships" m JOIN "users" u ON u."id" = m."user_id"
  WHERE m."household_id" = h."id" AND m."role" = 'ADMIN'
  ORDER BY m."joined_at", m."id" LIMIT 1
) AS admin_locale ON true;
```

The literal names and emoji must match `STARTER_CATEGORIES` in `packages/shared/src/categories.ts`; a shared unit test reads both to keep them in sync.

## Derived views (never stored)

- **Default weights of an expense**: `defaultWeights(members, category)` in `packages/shared` (R2). Returns the category's weights when `ownSplit`, the household's otherwise.
- **`CategoryView.weights[].shareBps`**: `weightsToBasisPoints` of the category's weights, or `null` while it follows the household. The web then shows the household's percentages.
- **`CategoryView.needsReview`**: R5.
- **`CategoryView.expenseCount`**: count of live expenses (`deletedAt IS NULL`) with that category, for the delete confirmation (FR-009).

## State transitions of a category

```text
            create (admin)
                 │
                 ▼
     ┌──── follows household ◄──── untick + confirm (weights deleted)
     │           │                         ▲
     │   tick + save weights               │
     │           ▼                         │
     │      own split ─────────────────────┘
     │           │   ▲
     │           │   └── save weights / join (+1 row) / leave (−1 row, cascade)
     ▼           ▼
   delete (admin, confirm) → row and weights gone; its expenses → categoryId NULL
```
