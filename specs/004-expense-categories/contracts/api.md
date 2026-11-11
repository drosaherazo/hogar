# API contract: Expense categories

REST, JSON, same conventions as `specs/002-expenses/contracts/api.md`: `Authorization: Bearer <access token>`, the caller's household is resolved on the server, bodies validated with the Zod schemas in `packages/shared`, and errors use the shape `{ "error": { "code": "<code>" } }`.

Authorization legend: **any** = any member of the caller's household (GUEST included); **editor** = ADMIN or MEMBER (403 `household.read_only` for a GUEST); **admin** = ADMIN only (403 `household.forbidden` for MEMBER and GUEST). Without a household, every endpoint answers 404 `household.not_member`.

## Types (shared, Zod, `packages/shared/src/categories.ts`)

```ts
CategoryName = string    // trimmed, 1–30 chars
CategoryEmoji = string   // exactly one emoji grapheme (R7)

CategoryRef = { id: string, name: string, emoji: string | null }

CategoryWeightView = { membershipId: string, userId: string, weight: number /* 0–100 */,
                       shareBps: number /* 10000 = 100 % */ }

CategoryView = {
  id, name, emoji: string | null, position: number,
  ownSplit: boolean,
  weights: CategoryWeightView[] | null,   // member order; null while it follows the household
  needsReview: boolean,                   // R5
  expenseCount: number,                   // live expenses in it (delete confirmation)
  version: number
}

// Requests
CreateCategoryInput = { name: CategoryName, emoji?: CategoryEmoji | null }
UpdateCategoryInput = { name: CategoryName, emoji: CategoryEmoji | null, version: number }
UpdateCategorySplitInput =
  | { version: number, ownSplit: false }
  | { version: number, ownSplit: true, weights: { membershipId: string, weight: number }[] }
      // one entry per current member, unique, not all 0

STARTER_CATEGORIES: readonly { emoji: string, name: { en: string, es: string } }[]   // R4
defaultWeights(members, category): number[]                                          // R2
```

## Categories

| Method & path                             | Auth  | Body                       | Success                              | Errors                                                                                                                                             |
| ----------------------------------------- | ----- | -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/household/categories`           | any   | —                          | 200 `{ categories: CategoryView[] }` | 404                                                                                                                                                |
| `POST /api/household/categories`          | admin | `CreateCategoryInput`      | 201 `{ category: CategoryView }`     | 400 `category.name.required` / `category.name.too_long` / `category.name.taken` / `category.emoji.invalid` / `category.limit_reached`; 403         |
| `PATCH /api/household/categories/:id`     | admin | `UpdateCategoryInput`      | 200 `{ category: CategoryView }`     | as POST (except limit); 404 `category.not_found`; 409 `category.changed`                                                                           |
| `PUT /api/household/categories/:id/split` | admin | `UpdateCategorySplitInput` | 200 `{ category: CategoryView }`     | 400 `split.weight.invalid` / `split.all_zero` / `request.invalid`; 403; 404 `category.not_found`; 409 `category.changed` / `split.members_changed` |
| `DELETE /api/household/categories/:id`    | admin | — (`?version=`)            | 204                                  | 400 `request.invalid` (no version); 403; 404 `category.not_found`; 409 `category.changed`                                                          |

Rules beyond the schema:

- Writes run under the household lock, so the name check, the 30-category limit and `position` can't race.
- Renaming or changing the emoji bumps `version` and never touches expenses or shares (FR-008).
- `PUT …/split` with `ownSplit: true` replaces every weight row and sets `splitSavedAt`; with `ownSplit: false` it deletes them. Both bump `version` and never touch expenses (FR-020).
- `DELETE` removes the category and its weights. Its expenses, live and deleted, get `categoryId = NULL`; their shares are untouched (FR-009).

## Changes to expense endpoints

**`ExpenseInput`** (POST and PUT `/api/household/expenses…`) gains `categoryId: string | null`, optional and defaulting to `null`. The `WEIGHTS` split gains `reapply` (R3):

```ts
ExpenseSplitInput =
  | { method: "WEIGHTS", reapply?: { shares: { userId: string, amountCents: number }[] } }
  | { method: "EQUAL", userIds: string[] }
  | { method: "EXACT", shares: { userId: string, amountCents: number }[] }
```

**`ExpenseView`** gains `category: CategoryRef | null`.

**`ActivityItem`** of kind `"expense"` gains `category: CategoryRef | null`.

Rules:

- `categoryId` must be a category of the caller's household, or the request gets 400 `expense.category.not_found`. That includes a category deleted after the form loaded.
- **POST with `WEIGHTS`** uses `defaultWeights(currentMembers, category)`. If they are all 0 or nobody has weight: 400 `expense.split.no_default` (FR-017).
- **PUT with `WEIGHTS` and no `reapply`** keeps the saved shares, rescaled if the amount changed (002 R3), whatever the category. This covers "keep the current shares" (FR-023).
- **PUT with `WEIGHTS` and `reapply`** recomputes with `defaultWeights(currentMembers, newCategory)`. If the result differs from `reapply.shares`, the API answers 409 `expense.split.changed` and saves nothing. If the weights are all 0: 400 `expense.split.no_default`.
- Changing only `categoryId` on an `EQUAL` or `EXACT` expense changes nothing else (FR-021).

## Changes to the history

`GET /api/household/activity` accepts `category?: string`, either a category id or `"none"`.

- **With a filter**: only expenses (live and deleted) with that category, or with none, are returned. Settlements are left out.
- **Unknown id**: an empty page, not an error, because the category may have just been deleted.
- **`GET /api/household/balances`** is unchanged and takes no filter (FR-027).

## Changes to household endpoints

- **`POST /api/household`** also creates the five starter categories in the creator's locale (R4).
- **`POST /api/invitations/accept`** also adds a weight (`defaultWeightFor(role)`) to every category with its own split (R5).
- **Leave and remove** need no change: the membership cascade removes the person's category weights.

## Permission matrix (each cell gets a Supertest case)

| Endpoint                             | ADMIN | MEMBER | GUEST | former member | other household                  | no household |
| ------------------------------------ | ----- | ------ | ----- | ------------- | -------------------------------- | ------------ |
| GET categories                       | 200   | 200    | 200   | 404           | own categories only              | 404          |
| POST category                        | 201   | 403    | 403   | 404           | creates in own household         | 404          |
| PATCH / PUT split / DELETE category  | 2xx   | 403    | 403   | 404           | 404 (id not in own household)    | 404          |
| POST / PUT expense with `categoryId` | 2xx   | 2xx    | 403   | 404           | 400 `expense.category.not_found` | 404          |
| GET activity with `category`         | 200   | 200    | 200   | 404           | empty page                       | 404          |

## New error codes (9)

`category.name.required`, `category.name.too_long`, `category.name.taken`, `category.emoji.invalid`, `category.limit_reached`, `category.not_found`, `category.changed`, `expense.category.not_found`, `expense.split.changed`.

Reused: `split.weight.invalid`, `split.all_zero`, `split.members_changed`, `expense.split.no_default`, `household.forbidden`, `household.read_only`.

Each new code goes into `ERROR_CODES` in `packages/shared/src/errors.ts`, with warm `en` and `es` messages in `apps/web/src/i18n/locales/{en,es}/errors.json`. Examples:

- `category.name.taken`: "There's already a category with that name." / "Ya hay una categoría con ese nombre."
- `expense.split.changed`: "The split changed while you were editing. Here are the new shares." / "El reparto ha cambiado mientras editabas. Estas son las partes nuevas."
