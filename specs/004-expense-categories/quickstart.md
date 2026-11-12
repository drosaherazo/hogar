# Quickstart: validate expense categories end to end

## Prerequisites

- Docker running, then `pnpm db:up` (on Windows, Docker Desktop with WSL).
- `apps/api/.env` and `apps/web/.env` copied from their `.env.example`; Google sign-in set up (`docs/setup-google-oauth.md`).
- `pnpm install`, then `pnpm db:migrate` to apply the categories migration.

## Automated checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test                        # shared, ui, web (Vitest) and api (Supertest, needs hogar_test)
pnpm --filter @hogar/web e2e     # Cypress, stubbed API (unset ELECTRON_RUN_AS_NODE if needed)
```

All of them must pass. The Supertest suite covers the permission matrix in [contracts/api.md](contracts/api.md).

## Manual walkthrough (two browsers: Ana as ADMIN, Bruno as MEMBER; weights 3 and 1)

### 1 · Starter set and categorizing (Story 1)

1. Ana creates a new household in Spanish. **Expect** five categories in the settings: 🏠 Alquiler, 🛒 Comida, 💡 Suministros, 🎉 Ocio, 📦 Otros.
2. Bruno adds €42.80 in "Comida". **Expect** the label on the row and in the details, split 75 % / 25 %.
3. Bruno adds a coffee with no category. **Expect** no label, the same split, nothing marked as missing.

### 2 · Managing categories (Story 2)

1. Ana renames "Suministros" to "Facturas" and adds "🐶 Perro". **Expect** existing rows to show the new name.
2. Ana tries "comida" as a new name. **Expect** "Ya hay una categoría con ese nombre."
3. Ana deletes "Comida". **Expect** the confirmation to say "1 gasto se quedará sin categoría. La parte de nadie cambia." After confirming, the groceries row has no label and the balances are identical to the cent.
4. Bruno opens the settings. **Expect** the list with no edit buttons and the read-only note.

### 3 · Own split (Story 3)

1. Ana edits "Alquiler", ticks "Usar un reparto propio". **Expect** weights prefilled with 3 and 1; she sets 1 and 1 and saves.
2. Bruno adds €900.00 in "Alquiler". **Expect** the form to say "Reparto de Alquiler" and preview €450.00 / €450.00 before saving.
3. Ana changes the household's weights to 2 and 1. **Expect** the €900.00 expense unchanged, new "Ocio" expenses at 67 % / 33 %, new "Alquiler" expenses still at 50 % / 50 %.
4. Invite Carla as MEMBER. **Expect** "Alquiler" to show the review badge and Carla with weight 1 in it.

### 4 · Changing an expense's category (Story 4)

1. Bruno records €900.00 in "Ocio" by mistake (split from household weights), then edits it to "Alquiler". **Expect** the dialog with each person's share before → after, "Aplicar el reparto de Alquiler" selected. Apply and save. **Expect** the saved shares to equal the preview and the balances to follow.
2. Ana moves the coffee (no category) to "Facturas" and chooses "Mantener las partes actuales". **Expect** only the label to change and the balances to stay the same.
3. Race check: open the dialog as Bruno, change "Alquiler" weights as Ana, then confirm as Bruno. **Expect** the dialog to reopen with the new figures and the "split changed" message; nothing is saved until Bruno confirms again.

### 5 · Filter (Story 5)

1. On `/expenses`, filter by "Alquiler". **Expect** only those expenses, no payments, "Mostrando: 🏠 Alquiler" and the URL with `?category=…`. Reload: the filter stays.
2. Filter by "Sin categoría", then by an unused category. **Expect** the friendly empty message in the second case.
3. Open the balances. **Expect** the same figures as without a filter.

### 6 · Backfill of existing households (once, before merging)

Against a copy of a database created before this feature (for example a `pg_dump` of local data restored into a scratch database), run `prisma migrate deploy`. **Expect**:

- every household to have the five starter categories, in the language of its longest-standing admin;
- every expense to have `category_id` NULL and its shares unchanged.

### 7 · Design checklist

Run the `docs/design.md` checklist on the settings section, the category dialog, the form, the category-change dialog and the filter, in `en` and `es` and in light and dark themes. Check keyboard-only use, and that a screen reader reads category names without the emoji.
