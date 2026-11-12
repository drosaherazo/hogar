# UI contract: Expense categories

Web changes in `apps/web` and one new component in `packages/ui`. Every visible string goes through i18n (keys below), and `docs/design.md` and its checklist apply to every screen.

## Routes

No new routes. Changes live in existing pages:

| Route                        | Page                    | Change                                                                                         |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `/household`                 | `HouseholdSettingsPage` | New **Categories** section after **Split** (Stories 2 and 3)                                   |
| `/expenses`                  | `ExpensesPage`          | Category filter above the history; category on each expense row (Stories 1 and 5)              |
| `/expenses/new`, `/:id/edit` | `ExpenseFormPage`       | Category select; split label and preview follow the category; category-change dialog (Story 4) |
| `/expenses/:id`              | `ExpenseDetailPage`     | Category under the description                                                                 |

## Settings · Categories section (`CategoriesSection.tsx`)

- **List**: one row per category in `position` order, showing the category label (R12) and a one-line summary of its split: "Follows the household's split" or "Own split: Ana 50 %, Bruno 50 %". A row with `needsReview` shows a warning `Badge` with text ("Review this split"), never color alone.
- **Admins** see "Add category" and an "Edit" button per row (accessible name "Edit Rent", so screen readers hear which one). MEMBERs and GUESTs see the same list with a read-only note ("Only admins can change categories."), and no buttons.
- **Edit dialog** (`CategoryDialog.tsx`, ui `Dialog`), with these fields:
  - **Name** (`TextField`, max 30).
  - **Emoji** (`TextField`, optional, hint "Pick one from your keyboard").
  - **"Use its own split"** (`Checkbox`, R11).
    - Unticked: shows the household's percentages, read-only.
    - Ticking it shows the `WeightsEditor` prefilled with a copy of the household's weights.
    - Unticking a category that has saved weights opens a confirmation ("Rent will follow the household's split again. Its own weights will be discarded.").
  - **Actions**: Save, Cancel and Delete category.
  - **Saving**: up to two requests in order, `PATCH` (name and emoji) and `PUT …/split`, only for what changed. Each uses the latest `version`.
- **Delete confirmation**: names the category and states the count and the safety ("12 expenses will be left without a category. Nobody's share will change." / "No expenses use it."). When the category has its own split, it also says its weights will be discarded. Focus starts on Cancel.
- **Add**: the same dialog without Delete. A new category always starts by following the household.
- **At 30 categories**: "Add category" is disabled, with a visible note explaining the limit.
- **No categories left**: an `EmptyState` inviting admins to add one.

## Expense form

- **Category** (`Select`): placed after the description. Its options are "No category" first (the default) and then the categories, each as "🏠 Rent".
- **Split label**: the `WEIGHTS` option names its source, computed with `defaultWeights`:
  - "The household's split" when there is no category or the category follows the household.
  - "Rent's split" when the category has its own split.
  - The preview below it updates as soon as the category changes (FR-015).
- **Previewed shares**: whenever the form saves fresh default shares (adding an expense with `WEIGHTS`, or switching an `EQUAL` or `EXACT` expense to `WEIGHTS`), it sends the shares it showed as `previewShares` (R3). On 409 `expense.split.changed`, it keeps every field, refetches the household and categories, shows the new preview and the error message, and the person saves again.
- **All-zero split**: when the chosen category has its own split and every weight is 0, `WEIGHTS` is not offered. The form shows the `noDefaultCategory` message with a link to `/household/settings#categories` (FR-017).
- **Editing**:
  - The saved-proportions label becomes neutral (R13): "The split when it was added (Ana 75 %, Bruno 25 %)".
  - When the person changes the category of a `WEIGHTS` expense and `defaultWeights` for the new category gives different shares than the saved ones (rescaled to the current amount), Save first opens the **category-change dialog**.
- **Category-change dialog** (`CategoryChangeDialog.tsx`):
  - **Title**: "The shares would change".
  - **Body**: a table with one row per person, showing their share before and after ("Ana: €675.00 → €450.00"), in words and numbers, never color alone.
  - **Choice** (`ChoiceGroup`): "Apply Rent's split" (selected) or "Keep the current shares".
  - **If the new category has no default split**: only "Keep the current shares" is offered, with a note and a pointer to choose another way to split (Story 4 #5).
  - **Confirm**: "Apply" sends `previewShares` with the previewed shares; "Keep" sends no `previewShares`.
  - **Errors**: on 409 `expense.split.changed`, the dialog reopens with the new figures and the error message.
- **Equal and exact splits**: changing only the category never opens the dialog (FR-021).
- **Deleted category**: on 400 `expense.category.not_found`, the form keeps every field, refetches the categories, resets the category to "No category" and shows the error next to the select.

## Expenses page

- **Filter** (`Select`, labeled "Category"): its options are "All expenses" (default), each category, and "No category".
  - The choice lives in the URL (`?category=<id>|none`), so it survives reloads and the back button.
  - The active filter is announced above the history in words ("Showing: Dog"; the select right above it shows the emoji).
  - Clear it with "Show everything".
- **Empty filtered list**: `EmptyState` with "No expenses in Dog yet." / "No expenses without a category." (FR-028).
- **History rows**: an expense with a category shows its label under the description. Rows with no category show nothing extra.

## `packages/ui` · new `Checkbox`

`Checkbox.tsx`, `.module.css`, `.test.tsx` (behavior + axe), `.stories.tsx` and a bilingual `.mdx`.

- **Props**: `label` (required, visible), optional `hint`, plus native input props (`checked`, `onChange`, `disabled`, `name`).
- **Markup**: native `<input type="checkbox">` with its `<label>`. The hint is linked through `aria-describedby`. The focus ring uses tokens.
- **Rules**: semantic tokens only, no copy inside the component, works in light and dark.

## Shared web pieces

- `apps/web/src/household/WeightsEditor.tsx`: weight rows (name, number input 0–100, resulting percentage), extracted from `SplitSection`, used by Split and by the category dialog.
- `apps/web/src/expenses/CategoryLabel.tsx`: neutral `Badge` with an `aria-hidden` emoji and the name (R12).
- `apps/web/src/expenses/useCategories.ts`: `GET /categories` query and the category mutations. Every mutation invalidates `categories`, `activity` and `household`.

## i18n keys

New and changed keys, generated from `apps/web/src/i18n/locales/{en,es}/*.json` at the end of implementation. `en` is the source; `es` mirrors every key (the parity test checks it).

| Namespace   | Key                                          | en                                                                                                                        | es                                                                                                                   |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `household` | `settings.categories.title`                  | Categories                                                                                                                | Categorías                                                                                                           |
| `household` | `settings.categories.description`            | Label expenses to tell them apart. A category can follow the household's split or have its own.                           | Etiqueta los gastos para distinguirlos. Una categoría puede seguir el reparto del hogar o tener el suyo.             |
| `household` | `settings.categories.add`                    | Add category                                                                                                              | Añadir categoría                                                                                                     |
| `household` | `settings.categories.edit`                   | Edit {{name}}                                                                                                             | Editar {{name}}                                                                                                      |
| `household` | `settings.categories.readOnly`               | Only admins can change categories.                                                                                        | Solo los admins pueden cambiar las categorías.                                                                       |
| `household` | `settings.categories.followsHousehold`       | Follows the household's split                                                                                             | Sigue el reparto del hogar                                                                                           |
| `household` | `settings.categories.ownSplit`               | Own split: {{shares}}                                                                                                     | Reparto propio: {{shares}}                                                                                           |
| `household` | `settings.categories.needsReview`            | Review this split: people have changed.                                                                                   | Revisa este reparto: ha cambiado la gente.                                                                           |
| `household` | `settings.categories.limit`                  | You've reached 30 categories. Delete one to add another.                                                                  | Habéis llegado a 30 categorías. Borra una para añadir otra.                                                          |
| `household` | `settings.categories.empty`                  | No categories yet. Add one to start labeling expenses.                                                                    | Aún no hay categorías. Añade una para empezar a etiquetar gastos.                                                    |
| `household` | `settings.categories.emptyReadOnly`          | No categories yet. An admin can add some to label expenses.                                                               | Aún no hay categorías. Un admin puede añadir algunas para etiquetar gastos.                                          |
| `household` | `settings.categories.dialog.titleNew`        | New category                                                                                                              | Nueva categoría                                                                                                      |
| `household` | `settings.categories.dialog.name`            | Name                                                                                                                      | Nombre                                                                                                               |
| `household` | `settings.categories.dialog.emoji`           | Emoji (optional)                                                                                                          | Emoji (opcional)                                                                                                     |
| `household` | `settings.categories.dialog.emojiHint`       | Pick one from your keyboard.                                                                                              | Elige uno del teclado.                                                                                               |
| `household` | `settings.categories.dialog.ownSplit`        | Use its own split                                                                                                         | Usar un reparto propio                                                                                               |
| `household` | `settings.categories.dialog.ownSplitHint`    | If unticked, it follows the household's split.                                                                            | Si no la marcas, sigue el reparto del hogar.                                                                         |
| `household` | `settings.categories.dialog.householdShares` | The household's split: {{shares}}                                                                                         | El reparto del hogar: {{shares}}                                                                                     |
| `household` | `settings.categories.dialog.save`            | Save category                                                                                                             | Guardar categoría                                                                                                    |
| `household` | `settings.categories.dialog.saving`          | Saving the category                                                                                                       | Guardando la categoría                                                                                               |
| `household` | `settings.categories.dialog.saved`           | Category saved.                                                                                                           | Categoría guardada.                                                                                                  |
| `household` | `settings.categories.untick.title`           | Follow the household's split?                                                                                             | ¿Seguir el reparto del hogar?                                                                                        |
| `household` | `settings.categories.untick.description`     | {{name}} will follow the household's split again. Its own weights will be discarded. Expenses already added won't change. | {{name}} volverá a seguir el reparto del hogar. Sus pesos propios se descartarán. Los gastos ya añadidos no cambian. |
| `household` | `settings.categories.untick.confirm`         | Follow the household's split                                                                                              | Seguir el reparto del hogar                                                                                          |
| `household` | `settings.categories.delete.action`          | Delete category                                                                                                           | Borrar categoría                                                                                                     |
| `household` | `settings.categories.delete.title`           | Delete {{name}}?                                                                                                          | ¿Borrar {{name}}?                                                                                                    |
| `household` | `settings.categories.delete.used_one`        | {{count}} expense will be left without a category. Nobody's share will change.                                            | {{count}} gasto se quedará sin categoría. La parte de nadie cambia.                                                  |
| `household` | `settings.categories.delete.used_other`      | {{count}} expenses will be left without a category. Nobody's share will change.                                           | {{count}} gastos se quedarán sin categoría. La parte de nadie cambia.                                                |
| `household` | `settings.categories.delete.unused`          | No expenses use it.                                                                                                       | Ningún gasto la usa.                                                                                                 |
| `household` | `settings.categories.delete.ownSplit`        | Its own split will be discarded too.                                                                                      | Su reparto propio también se descartará.                                                                             |
| `household` | `settings.categories.delete.deleting`        | Deleting the category                                                                                                     | Borrando la categoría                                                                                                |
| `household` | `settings.categories.delete.deleted`         | Category deleted.                                                                                                         | Categoría borrada.                                                                                                   |
| `household` | `settings.categories.editButton`             | Edit                                                                                                                      | Editar                                                                                                               |
| `expenses`  | `form.split.weightsSaved` (changed)          | The split when it was added ({{shares}})                                                                                  | El reparto cuando se añadió ({{shares}})                                                                             |
| `expenses`  | `form.split.weightsCategory`                 | {{name}}'s split                                                                                                          | Reparto de {{name}}                                                                                                  |
| `expenses`  | `form.split.noDefaultCategory`               | Nobody pays in {{name}}'s split. Choose people, or review the category.                                                   | Nadie paga en el reparto de {{name}}. Elige personas o revisa la categoría.                                          |
| `expenses`  | `form.split.reviewCategory`                  | Review the category                                                                                                       | Revisar la categoría                                                                                                 |
| `expenses`  | `form.category.label`                        | Category                                                                                                                  | Categoría                                                                                                            |
| `expenses`  | `form.category.none`                         | No category                                                                                                               | Sin categoría                                                                                                        |
| `expenses`  | `details.method.WEIGHTS` (changed)           | In proportion to the weights                                                                                              | En proporción a los pesos                                                                                            |
| `expenses`  | `categoryChange.title`                       | The shares would change                                                                                                   | Las partes cambiarían                                                                                                |
| `expenses`  | `categoryChange.intro`                       | Moving it to {{name}} changes who pays what:                                                                              | Al pasarlo a {{name}} cambia quién paga qué:                                                                         |
| `expenses`  | `categoryChange.introNone`                   | Leaving it without a category changes who pays what:                                                                      | Al dejarlo sin categoría cambia quién paga qué:                                                                      |
| `expenses`  | `categoryChange.row`                         | {{name}}: {{before}} → {{after}}                                                                                          | {{name}}: {{before}} → {{after}}                                                                                     |
| `expenses`  | `categoryChange.legend`                      | What should happen to the shares?                                                                                         | ¿Qué hacemos con las partes?                                                                                         |
| `expenses`  | `categoryChange.apply`                       | Apply {{name}}'s split                                                                                                    | Aplicar el reparto de {{name}}                                                                                       |
| `expenses`  | `categoryChange.applyHousehold`              | Apply the household's split                                                                                               | Aplicar el reparto del hogar                                                                                         |
| `expenses`  | `categoryChange.keep`                        | Keep the current shares                                                                                                   | Mantener las partes actuales                                                                                         |
| `expenses`  | `categoryChange.noDefault`                   | {{name}}'s split has nobody paying, so it can't be applied.                                                               | En el reparto de {{name}} no paga nadie, así que no se puede aplicar.                                                |
| `expenses`  | `categoryChange.confirm`                     | Save expense                                                                                                              | Guardar gasto                                                                                                        |
| `expenses`  | `categoryChange.close`                       | Close                                                                                                                     | Cerrar                                                                                                               |
| `expenses`  | `categoryChange.cancel`                      | Back to the form                                                                                                          | Volver al formulario                                                                                                 |
| `expenses`  | `filter.label`                               | Category                                                                                                                  | Categoría                                                                                                            |
| `expenses`  | `filter.all`                                 | All expenses                                                                                                              | Todos los gastos                                                                                                     |
| `expenses`  | `filter.none`                                | No category                                                                                                               | Sin categoría                                                                                                        |
| `expenses`  | `filter.showing`                             | Showing: {{name}}                                                                                                         | Mostrando: {{name}}                                                                                                  |
| `expenses`  | `filter.showingNone`                         | Showing: expenses without a category                                                                                      | Mostrando: gastos sin categoría                                                                                      |
| `expenses`  | `filter.clear`                               | Show everything                                                                                                           | Mostrar todo                                                                                                         |
| `expenses`  | `filter.empty`                               | No expenses in {{name}} yet.                                                                                              | Aún no hay gastos en {{name}}.                                                                                       |
| `expenses`  | `filter.emptyNone`                           | No expenses without a category.                                                                                           | No hay gastos sin categoría.                                                                                         |
| `errors`    | `expense.split.changed`                      | The split changed while you were editing. Here are the new shares.                                                        | El reparto ha cambiado mientras editabas. Estas son las partes nuevas.                                               |
| `errors`    | `expense.category.not_found`                 | That category isn't here any more. Pick another one, or leave it without a category.                                      | Esa categoría ya no está. Elige otra o déjalo sin categoría.                                                         |
| `errors`    | `category.name.required`                     | Give the category a name, so everyone recognises it.                                                                      | Ponle un nombre a la categoría para que todo el mundo la reconozca.                                                  |
| `errors`    | `category.name.too_long`                     | That name is a bit long. Keep it to 30 characters or fewer.                                                               | Ese nombre es un poco largo. Que no pase de 30 caracteres.                                                           |
| `errors`    | `category.name.taken`                        | There's already a category with that name.                                                                                | Ya hay una categoría con ese nombre.                                                                                 |
| `errors`    | `category.emoji.invalid`                     | Pick just one emoji, or leave it empty.                                                                                   | Elige un solo emoji, o déjalo vacío.                                                                                 |
| `errors`    | `category.limit_reached`                     | You've reached 30 categories. Delete one to add another.                                                                  | Habéis llegado a 30 categorías. Borra una para añadir otra.                                                          |
| `errors`    | `category.not_found`                         | That category isn't here any more. Someone may have deleted it.                                                           | Esa categoría ya no está. Puede que alguien la haya borrado.                                                         |
| `errors`    | `category.changed`                           | Someone changed this category while you were editing it. Here's the latest version.                                       | Alguien cambió esta categoría mientras la editabas. Aquí tienes la versión más reciente.                             |
