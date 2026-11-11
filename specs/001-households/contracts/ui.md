# UI contract: Households

Routes in `apps/web/src/App.tsx`. Copy lives in a new `household` i18n namespace (`en` is the source, `es` at parity), and errors go through the `errors` namespace by code.

## Routes

| Path                  | Guard                                        | Shows                                                                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | `RequireAuth`                                | No household → welcome + "Create a household" (opens dialog) + how to join; removal note (`Alert`) if `removedFrom`. Household → name, members summary, link to settings, split review banner for admins.                                                                                 |
| `/household/settings` | `RequireAuth` + has household                | Three sections: **Name**, **Members** (list, role menu, remove, leave, pending invitations for admins), **Split** (weights and percentages; editable by admins). Redirects to `/` without a household.                                                                                    |
| `/invite`             | `RequireAuth` (keeps `#token` through login) | Reads `location.hash`, calls lookup, renders one of: can join (household, inviter, role, **Join**), already a member (link home), has another household (explanation + **Leave my household** with confirmation), invalid/expired/used/revoked (kind explanation + "ask for a new link"). |

## Key interactions

- **Create household:** a `Dialog` with a `TextField` for the name; inline errors from Zod codes. On success it routes to `/`.
- **Invite:** a `Dialog` with a role radio fieldset (MEMBER default, GUEST), then a "Copy link" view showing `${origin}/invite#${token}` with a copy button and a note that it works once and expires in 12 hours.
- **Pending invitations:** rows show role, creator and relative time left (`Intl.RelativeTimeFormat`); actions **New link** (renew, then the copy view) and **Revoke** (confirmation).
- **Members:** each row has `Avatar`, name, role `Badge`; admins get a `Menu` with a `MenuRadioGroup` for the role and **Remove** (confirmation `Dialog`). Disabled actions explain why (for example "You're the only admin"), using `checkAdminInvariant`.
- **Leave:** confirmation `Dialog`. The text warns when leaving deletes the household (last member).
- **Split:** a `TextField type="number"` (0–100) per member with the live percentage beside it. **Save** is disabled while invalid. A warning `Alert` banner appears when `splitNeedsReview`. Non-admins see read-only values.

## New `packages/ui` components

| Component   | Purpose                                      | Notes                                                                            |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `TextField` | labelled input with hint and error           | `label` required; error linked with `aria-describedby`; supports `type="number"` |
| `Dialog`    | modal for confirmations and forms            | Radix Dialog; `title` and close label required via props; focus trap             |
| `Alert`     | inline message (`info`, `warning`, `danger`) | icon + text, `role="status"` or `alert` by tone                                  |

Each follows the `Button` folder pattern (tsx, module.css, test with axe, stories, bilingual MDX).
