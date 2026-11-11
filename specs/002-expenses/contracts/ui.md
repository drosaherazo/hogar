# UI contract: Expenses

Routes in `apps/web/src/App.tsx`. Copy lives in a new `expenses` i18n namespace (`en` is the source, `es` at parity), plus a few changes to `household` and `common`. Errors go through the `errors` namespace by code. Amounts are shown with `Amount` / `formatAmount` (`Intl`, active locale) and dates with `Intl.DateTimeFormat`.

## Routes

| Path                 | Guard                               | Shows                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/expenses`          | `RequireAuth` + has household       | The viewer's balance sentence and a link to balances. **Add expense** (editors). The history of expenses and payments grouped by month, with **Show more**. An empty state when there is nothing yet.                                           |
| `/expenses/new`      | + editor (others go to `/expenses`) | The expense form (create).                                                                                                                                                                                                                      |
| `/expenses/:id`      | + has household                     | Expense details: amount, description, date, who paid, how it was split, every share, who recorded and last changed it. **Edit** and **Delete** for editors.                                                                                     |
| `/expenses/:id/edit` | + editor                            | The expense form (edit), prefilled, with the record's `version`.                                                                                                                                                                                |
| `/balances`          | + has household                     | Each person's balance in words (current members in member order, then former members with an open balance). Suggested payments, each with **Record this payment** (editors). **Record a payment** (editors). "All square" when nothing is owed. |

Without a household, these routes redirect to `/`.

## Changes to existing screens

- **App shell:** a primary navigation (Home, Expenses) appears once the person has a household; the current page is marked with `aria-current="page"`.
- **Home (household state):** a balance card with the viewer's sentence ("You owe €10.70 in total"), links to **Expenses** and **Balances**, and **Add expense** for editors (FR-017).
- **Settings › Members:**
  - **Leave and remove dialogs:** add the person's open balance in words when it isn't zero (FR-026).
  - **Last-member leave dialog:** now says that the household's expenses and payments will be deleted too (FR-030).
  - The invitation role picker moves to `ChoiceGroup`.

## Key interactions

- **Expense form:**
  - **Fields:**
    - Description (`TextField`).
    - Amount (`TextField`, `inputMode="decimal"`, parsed by `parseAmount`).
    - Paid by (`Select` of current members, defaulting to the viewer).
    - Date (`TextField type="date"`, default and `max` = local today).
    - How to split (`ChoiceGroup`): "The household's split" with the percentages, "Equally between…" or "Exact amounts".
  - **The live preview** uses `splitAmount` from `shared`, so it matches what the API saves:
    - **Household split:** each person's share.
    - **Equally:** a `ChoiceGroup multiple` of people, all current members preselected, with each chosen person's share.
    - **Exact amounts:** one inline `TextField` per person, with "€2.50 left to assign" or "€1.00 over the total". **Save** stays disabled until it adds up.
  - **When every weight is 0:** "The household's split" is disabled, with a note and a link to the split settings (FR-010).
  - **When editing:** former members already in the expense stay listed with a "former member" badge. A default-split expense describes that option with the proportions it was recorded with ("The household's split when it was added: Ana 75 %, Bruno 25 %"). Its stored shares are kept, and they are only rescaled when the amount changes, with the new shares shown before saving (FR-009).
  - **On 409 `expense.changed`:** an `Alert` explains, and the form reloads the latest version.
- **Expense details:** shares listed with `Avatar` (member colors by join order; muted for former members) and `Amount`. **Delete** opens a `Dialog` that names the expense ("Delete 'Groceries' (€42.80)?"), with initial focus on **Cancel**.
- **History rows:**
  - **Contents:** an icon for the kind (receipt or payment) plus text, so color is never the only signal; the description or "Bruno paid Ana"; the amount; the date. Expenses also show the viewer's part: "You owe €10.70", "You lent €32.10" or "Not involved".
  - **Navigation:** expense rows link to their details. Payment rows open a payment `Dialog` with who recorded and changed it, plus **Edit** and **Delete** (editors).
  - **Deleted records:** they stay at their original date as a muted line with a trash icon and text, "Ana deleted 'Groceries' (€42.80)" or "Ana deleted the payment from Bruno to Ana (€13.20)". The line can't be opened or edited and shows no viewer's part (FR-025, research R17).
  - **Paging:** **Show more** loads the next page (infinite query).
- **Payment dialog (record or edit):**
  - **Fields:** From and To (`Select`s of current members, plus former members with an open balance, plus, when editing, the record's own people), Amount and Date.
  - **What's owed:** a line shows what is currently owed between the two ("Right now, Bruno owes Ana €10.70"). An amount above it adds a gentle note that the balance will reverse (FR-020).
  - **From a suggestion:** choosing **Record this payment** opens the dialog prefilled (FR-019).
- **Balances:** each row has an `Avatar`, a sentence in words and `Amount`. Former members get a muted avatar and a "Former member" `Badge`. The viewer's own row and suggestions are phrased in the second person (FR-016).

## New and changed `packages/ui` components

| Component       | Purpose                                                  | Notes                                                                                                                                           |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Amount`        | a euro amount, formatted for the active locale           | `cents` prop; tabular numbers; exports `formatAmount(cents, locale)` for sentences; no copy                                                     |
| `ChoiceGroup`   | a labelled group of options: single choice or `multiple` | native radios or checkboxes in a `fieldset` + `legend`; each option has `label`, optional `hint` and `disabled`; extracted from the role picker |
| `Select`        | a labelled native select with hint and error             | mirrors `TextField` (label required, `aria-describedby`, `aria-invalid`); 44 px tall                                                            |
| `Avatar` (edit) | new `muted` variant                                      | neutral sand fill for people who are no longer members; the "former member" text comes from the app                                             |

Each new component follows the `Button` folder pattern (tsx, module.css, test with axe, stories, bilingual MDX).

## New i18n keys

The `expenses` table below is generated from the JSON files; the others were checked against them. `en` is the source of truth and the parity test keeps `es` identical in keys.

### `expenses` namespace (new, 111 keys)

| Key                                      | en                                                                                       | es                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `expenses:title`                         | Expenses                                                                                 | Gastos                                                                                  |
| `expenses:add`                           | Add expense                                                                              | Añadir gasto                                                                            |
| `expenses:loadError`                     | We couldn't load the expenses.                                                           | No hemos podido cargar los gastos.                                                      |
| `expenses:empty.title`                   | No expenses yet                                                                          | Aún no hay gastos                                                                       |
| `expenses:empty.description`             | When someone pays for something everyone shares, add it here.                            | Cuando alguien pague algo que compartís, añádelo aquí.                                  |
| `expenses:history.label`                 | History                                                                                  | Historial                                                                               |
| `expenses:history.showMore`              | Show more                                                                                | Ver más                                                                                 |
| `expenses:history.loadingMore`           | Loading more                                                                             | Cargando más                                                                            |
| `expenses:history.paid`                  | {{name}} paid                                                                            | Pagó {{name}}                                                                           |
| `expenses:history.youPaid`               | You paid                                                                                 | Pagaste tú                                                                              |
| `expenses:history.payment`               | {{from}} paid {{to}}                                                                     | {{from}} le pagó a {{to}}                                                               |
| `expenses:history.deletedExpense`        | {{name}} deleted "{{description}}" ({{amount}})                                          | {{name}} borró «{{description}}» ({{amount}})                                           |
| `expenses:history.deletedPayment`        | {{name}} deleted the payment from {{from}} to {{to}} ({{amount}})                        | {{name}} borró el pago de {{from}} a {{to}} ({{amount}})                                |
| `expenses:part.owes`                     | You owe {{amount}}                                                                       | Debes {{amount}}                                                                        |
| `expenses:part.lent`                     | You lent {{amount}}                                                                      | Prestaste {{amount}}                                                                    |
| `expenses:part.none`                     | Not involved                                                                             | No participas                                                                           |
| `expenses:home.title`                    | Expenses                                                                                 | Gastos                                                                                  |
| `expenses:home.seeExpenses`              | See expenses                                                                             | Ver gastos                                                                              |
| `expenses:balances.title`                | Balances                                                                                 | Saldos                                                                                  |
| `expenses:balances.link`                 | See balances                                                                             | Ver saldos                                                                              |
| `expenses:balances.back`                 | Back to expenses                                                                         | Volver a gastos                                                                         |
| `expenses:balances.loadError`            | We couldn't load the balances.                                                           | No hemos podido cargar los saldos.                                                      |
| `expenses:balances.youOwe`               | You owe {{amount}} in total                                                              | Debes {{amount}} en total                                                               |
| `expenses:balances.youAreOwed`           | You're owed {{amount}} in total                                                          | Te deben {{amount}} en total                                                            |
| `expenses:balances.youAreSquare`         | You're all square                                                                        | Estás al día                                                                            |
| `expenses:balances.personOwes`           | {{name}} owes {{amount}}                                                                 | {{name}} debe {{amount}}                                                                |
| `expenses:balances.personIsOwed`         | {{name}} is owed {{amount}}                                                              | A {{name}} le deben {{amount}}                                                          |
| `expenses:balances.personIsSquare`       | {{name}} is all square                                                                   | {{name}} está al día                                                                    |
| `expenses:balances.allSquare`            | All square! Nobody owes anything.                                                        | ¡Todo al día! Nadie debe nada.                                                          |
| `expenses:balances.allSquareDescription` | When someone pays for something everyone shares, you'll see here who owes whom.          | Cuando alguien pague algo que compartís, aquí verás quién debe a quién.                 |
| `expenses:balances.everyone`             | Everyone's balance                                                                       | El saldo de cada persona                                                                |
| `expenses:balances.suggestions`          | Payments that would settle everyone                                                      | Pagos para quedar todos al día                                                          |
| `expenses:balances.former`               | Former member                                                                            | Ya no está en el hogar                                                                  |
| `expenses:balances.formerName`           | {{name}} (former member)                                                                 | {{name}} (ya no está en el hogar)                                                       |
| `expenses:suggest.youPay`                | You owe {{name}} {{amount}}                                                              | Le debes {{amount}} a {{name}}                                                          |
| `expenses:suggest.paysYou`               | {{name}} owes you {{amount}}                                                             | {{name}} te debe {{amount}}                                                             |
| `expenses:suggest.others`                | {{from}} owes {{to}} {{amount}}                                                          | {{from}} le debe {{amount}} a {{to}}                                                    |
| `expenses:suggest.record`                | Record this payment                                                                      | Anotar este pago                                                                        |
| `expenses:payment.record`                | Record a payment                                                                         | Anotar un pago                                                                          |
| `expenses:payment.recordTitle`           | Record a payment                                                                         | Anotar un pago                                                                          |
| `expenses:payment.description`           | Write down money that changed hands outside the app, so the balances stay right.         | Apunta el dinero que se ha movido fuera de la app, para que los saldos sigan cuadrando. |
| `expenses:payment.from`                  | Who paid?                                                                                | ¿Quién pagó?                                                                            |
| `expenses:payment.to`                    | Who received it?                                                                         | ¿Quién lo recibió?                                                                      |
| `expenses:payment.amount`                | Amount (€)                                                                               | Importe (€)                                                                             |
| `expenses:payment.date`                  | Date                                                                                     | Fecha                                                                                   |
| `expenses:payment.owedNow`               | Right now, {{from}} owes {{to}} {{amount}}.                                              | Ahora mismo, {{from}} le debe {{amount}} a {{to}}.                                      |
| `expenses:payment.reverses`              | That's more than what's owed, so afterwards {{to}} will owe {{from}} {{amount}}.         | Es más de lo que se debe, así que después {{to}} le deberá {{amount}} a {{from}}.       |
| `expenses:payment.save`                  | Record payment                                                                           | Anotar pago                                                                             |
| `expenses:payment.saving`                | Recording the payment                                                                    | Anotando el pago                                                                        |
| `expenses:payment.saved`                 | Payment recorded.                                                                        | Pago anotado.                                                                           |
| `expenses:payment.detailsTitle`          | Payment                                                                                  | Pago                                                                                    |
| `expenses:payment.paid`                  | {{from}} paid {{to}}                                                                     | {{from}} le pagó a {{to}}                                                               |
| `expenses:payment.recordedBy`            | Added by {{name}} on {{date}}                                                            | Lo anotó {{name}} el {{date}}                                                           |
| `expenses:payment.close`                 | Close                                                                                    | Cerrar                                                                                  |
| `expenses:payment.cancel`                | Cancel                                                                                   | Cancelar                                                                                |
| `expenses:payment.edit`                  | Edit                                                                                     | Editar                                                                                  |
| `expenses:payment.remove`                | Delete                                                                                   | Borrar                                                                                  |
| `expenses:payment.editTitle`             | Edit payment                                                                             | Editar pago                                                                             |
| `expenses:payment.editedBy`              | Changed by {{name}} on {{date}}                                                          | Lo cambió {{name}} el {{date}}                                                          |
| `expenses:payment.update`                | Save changes                                                                             | Guardar cambios                                                                         |
| `expenses:payment.updating`              | Saving the changes                                                                       | Guardando los cambios                                                                   |
| `expenses:payment.delete.title`          | Delete the payment from {{from}} to {{to}} ({{amount}})?                                 | ¿Borrar el pago de {{from}} a {{to}} ({{amount}})?                                      |
| `expenses:payment.delete.description`    | It will stop counting in the balances. The history will keep a note that you deleted it. | Dejará de contar en los saldos. El historial guardará una nota de que lo borraste.      |
| `expenses:payment.delete.confirm`        | Delete payment                                                                           | Borrar pago                                                                             |
| `expenses:payment.delete.deleting`       | Deleting the payment                                                                     | Borrando el pago                                                                        |
| `expenses:form.newTitle`                 | Add an expense                                                                           | Añadir un gasto                                                                         |
| `expenses:form.back`                     | Back to expenses                                                                         | Volver a gastos                                                                         |
| `expenses:form.description`              | What was it?                                                                             | ¿Qué fue?                                                                               |
| `expenses:form.descriptionHint`          | Up to 100 characters, so everyone recognises it.                                         | Hasta 100 caracteres, para que todo el mundo lo reconozca.                              |
| `expenses:form.amount`                   | Amount (€)                                                                               | Importe (€)                                                                             |
| `expenses:form.amountHint`               | For example 42.80.                                                                       | Por ejemplo, 42,80.                                                                     |
| `expenses:form.paidBy`                   | Who paid?                                                                                | ¿Quién pagó?                                                                            |
| `expenses:form.date`                     | Date                                                                                     | Fecha                                                                                   |
| `expenses:form.split.legend`             | How should it be split?                                                                  | ¿Cómo se reparte?                                                                       |
| `expenses:form.split.weights`            | The household's split                                                                    | El reparto del hogar                                                                    |
| `expenses:form.split.equal`              | Equally between…                                                                         | A partes iguales entre…                                                                 |
| `expenses:form.split.exact`              | Exact amounts                                                                            | Importes exactos                                                                        |
| `expenses:form.split.who`                | Who shares it?                                                                           | ¿Entre quién se reparte?                                                                |
| `expenses:form.split.amounts`            | How much each person pays                                                                | Cuánto paga cada persona                                                                |
| `expenses:form.split.left`               | {{amount}} left to assign                                                                | Faltan {{amount}} por asignar                                                           |
| `expenses:form.split.over`               | {{amount}} over the total                                                                | Te pasas {{amount}} del total                                                           |
| `expenses:form.split.noDefault`          | Nobody pays in the household's split yet. Choose people, or review the split.            | Todavía nadie paga en el reparto del hogar. Elige personas o revisa el reparto.         |
| `expenses:form.split.reviewSplit`        | Review the split                                                                         | Revisar el reparto                                                                      |
| `expenses:form.split.preview`            | Each person's share                                                                      | La parte de cada persona                                                                |
| `expenses:form.split.weightsSaved`       | The household's split when it was added ({{shares}})                                     | El reparto del hogar cuando se anotó ({{shares}})                                       |
| `expenses:form.save`                     | Save expense                                                                             | Guardar gasto                                                                           |
| `expenses:form.saving`                   | Saving the expense                                                                       | Guardando el gasto                                                                      |
| `expenses:form.cancel`                   | Cancel                                                                                   | Cancelar                                                                                |
| `expenses:form.editTitle`                | Edit expense                                                                             | Editar gasto                                                                            |
| `expenses:form.backToExpense`            | Back to the expense                                                                      | Volver al gasto                                                                         |
| `expenses:details.back`                  | Back to expenses                                                                         | Volver a gastos                                                                         |
| `expenses:details.paidBy`                | Paid by                                                                                  | Pagó                                                                                    |
| `expenses:details.date`                  | Date                                                                                     | Fecha                                                                                   |
| `expenses:details.split`                 | How it's split                                                                           | Cómo se reparte                                                                         |
| `expenses:details.shares`                | Each person's share                                                                      | La parte de cada persona                                                                |
| `expenses:details.recordedBy`            | Added by {{name}} on {{date}}                                                            | Lo añadió {{name}} el {{date}}                                                          |
| `expenses:details.saved`                 | Expense saved.                                                                           | Gasto guardado.                                                                         |
| `expenses:details.method.WEIGHTS`        | The household's split                                                                    | El reparto del hogar                                                                    |
| `expenses:details.method.EQUAL_one`      | Equally between {{count}} person                                                         | A partes iguales entre {{count}} persona                                                |
| `expenses:details.method.EQUAL_other`    | Equally between {{count}} people                                                         | A partes iguales entre {{count}} personas                                               |
| `expenses:details.method.EXACT`          | Exact amounts                                                                            | Importes exactos                                                                        |
| `expenses:details.edit`                  | Edit                                                                                     | Editar                                                                                  |
| `expenses:details.remove`                | Delete                                                                                   | Borrar                                                                                  |
| `expenses:details.editedBy`              | Changed by {{name}} on {{date}}                                                          | Lo cambió {{name}} el {{date}}                                                          |
| `expenses:delete.title`                  | Delete "{{description}}" ({{amount}})?                                                   | ¿Borrar «{{description}}» ({{amount}})?                                                 |
| `expenses:delete.description`            | It will stop counting in the balances. The history will keep a note that you deleted it. | Dejará de contar en los saldos. El historial guardará una nota de que lo borraste.      |
| `expenses:delete.confirm`                | Delete expense                                                                           | Borrar gasto                                                                            |
| `expenses:delete.deleting`               | Deleting the expense                                                                     | Borrando el gasto                                                                       |
| `expenses:delete.cancel`                 | Cancel                                                                                   | Cancelar                                                                                |
| `expenses:delete.done`                   | Expense deleted.                                                                         | Gasto borrado.                                                                          |
| `expenses:delete.close`                  | Close                                                                                    | Cerrar                                                                                  |

### `household` namespace (changed)

| Key                                                           | en                                                                                                                    | es                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `household:settings.members.leaveOwes`                        | You still owe {{amount}} in total. It will stay in the balances under your name until someone records that it's paid. | Todavía debes {{amount}} en total. Seguirá en los saldos a tu nombre hasta que alguien anote que está pagado. |
| `household:settings.members.leaveOwed`                        | You're still owed {{amount}} in total. It will stay in the balances until the others record that they've paid you.    | Todavía te deben {{amount}} en total. Seguirá en los saldos hasta que el resto anote que te lo ha pagado.     |
| `household:settings.members.removeOwes`                       | {{name}} still owes {{amount}} in total. It will stay in the balances until someone records that it's paid.           | {{name}} todavía debe {{amount}} en total. Seguirá en los saldos hasta que alguien anote que está pagado.     |
| `household:settings.members.removeOwed`                       | {{name}} is still owed {{amount}} in total. It will stay in the balances until it's paid.                             | A {{name}} todavía le deben {{amount}} en total. Seguirá en los saldos hasta que se le pague.                 |
| `household:settings.members.leaveLastDescription` (new value) | You're the only person here, so {{household}} and all its expenses and payments will be deleted when you leave.       | Eres la única persona aquí, así que {{household}} y todos sus gastos y pagos se borrarán cuando salgas.       |

### `common` namespace (new)

| Key                   | en       | es        |
| --------------------- | -------- | --------- |
| `common:nav.label`    | Main     | Principal |
| `common:nav.home`     | Home     | Inicio    |
| `common:nav.expenses` | Expenses | Gastos    |

### `errors` namespace: the 16 new codes

`household.read_only` was added during implementation: guests calling an editor endpoint would otherwise read the admin-only `household.forbidden` message ("Only the household's admins can do that"), which is wrong for content members can edit.

| Key                                   | en                                                                                             | es                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `errors:household.read_only`          | Guests can see everything here, but only members and admins can make changes.                  | Las personas invitadas pueden verlo todo, pero solo los miembros y administradores pueden hacer cambios. |
| `errors:money.amount.invalid`         | Enter an amount from €0.01 to €100,000.00.                                                     | Escribe un importe entre 0,01 € y 100.000,00 €.                                                          |
| `errors:money.date.invalid`           | That date doesn't look right. Pick it from the calendar.                                       | Esa fecha no parece correcta. Elígela en el calendario.                                                  |
| `errors:money.date.future`            | That date hasn't happened yet. Choose today or an earlier day.                                 | Esa fecha aún no ha llegado. Elige hoy o un día anterior.                                                |
| `errors:expense.description.required` | Say what it was, so everyone recognises it.                                                    | Di qué fue, para que todo el mundo lo reconozca.                                                         |
| `errors:expense.description.too_long` | That description is a bit long. Keep it to 100 characters or fewer.                            | Esa descripción es un poco larga. Que no pase de 100 caracteres.                                         |
| `errors:expense.split.invalid`        | Choose at least one person to share it.                                                        | Elige al menos a una persona para repartirlo.                                                            |
| `errors:expense.split.mismatch`       | The amounts don't add up to the total yet.                                                     | Los importes todavía no suman el total.                                                                  |
| `errors:expense.split.no_default`     | Nobody pays in the household's split yet. Choose people, or review the split first.            | Todavía nadie paga en el reparto del hogar. Elige personas o revisa antes el reparto.                    |
| `errors:expense.person.not_member`    | Someone in this expense is no longer part of the household. Review who paid and who shares it. | Alguien de este gasto ya no forma parte del hogar. Revisa quién pagó y entre quién se reparte.           |
| `errors:expense.not_found`            | That expense isn't here any more. Someone may have deleted it.                                 | Ese gasto ya no está. Puede que alguien lo haya borrado.                                                 |
| `errors:expense.changed`              | Someone changed this expense while you were editing it. Here's the latest version.             | Alguien cambió este gasto mientras lo editabas. Aquí tienes la versión más reciente.                     |
| `errors:settlement.same_person`       | Choose two different people.                                                                   | Elige a dos personas distintas.                                                                          |
| `errors:settlement.person.not_found`  | That person isn't part of this household's history.                                            | Esa persona no forma parte del historial de este hogar.                                                  |
| `errors:settlement.not_found`         | That payment isn't here any more. Someone may have deleted it.                                 | Ese pago ya no está. Puede que alguien lo haya borrado.                                                  |
| `errors:settlement.changed`           | Someone changed this payment while you were editing it. Here's the latest version.             | Alguien cambió este pago mientras lo editabas. Aquí tienes la versión más reciente.                      |
