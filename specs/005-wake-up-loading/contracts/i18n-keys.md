# Contract: new i18n keys (`common` namespace)

All keys go in `apps/web/src/i18n/locales/{en,es}/common.json` under `wakeUp`. `en` is the source
of truth. The existing `loading` key stays: in-app spinners still use it (FR-014).

The tone follows `docs/design.md`: second person, short sentences, the household as a living home,
no blame. Spanish is written for Spanish speakers, not translated word for word. Tips mention only
features that exist today (no chores, shopping list, real time or categories yet).

| Key                          | en                                                                                                | es                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `wakeUp.stage.knocking`      | Knocking on your home's door…                                                                     | Llamando a la puerta de tu hogar…                                                                                    |
| `wakeUp.stage.lights`        | Turning on the lights…                                                                            | Encendiendo las luces…                                                                                               |
| `wakeUp.stage.almost`        | Almost there, putting the kettle on…                                                              | Ya casi está, poniendo el agua a calentar…                                                                           |
| `wakeUp.description`         | Hogar takes a nap when nobody's around, so waking up can take up to a minute. Thanks for waiting! | Hogar se echa la siesta cuando no hay nadie, así que despertarse puede llevar hasta un minuto. ¡Gracias por esperar! |
| `wakeUp.tipLabel`            | Quick tip                                                                                         | Un consejo                                                                                                           |
| `wakeUp.tips.inviteLink`     | Invite the people you live with by sharing a link. No emails needed.                              | Invita a quien vive contigo compartiendo un enlace. Sin emails de por medio.                                         |
| `wakeUp.tips.weights`        | Give each person a weight in the household settings and every expense splits in that proportion.  | Dale un peso a cada persona en los ajustes del hogar y cada gasto se repartirá en esa proporción.                    |
| `wakeUp.tips.exactCents`     | Splits always add up to the exact cent, so nobody ends up a cent short.                           | Los repartos siempre cuadran al céntimo: nadie se queda con un céntimo de menos.                                     |
| `wakeUp.tips.customSplit`    | One expense works differently? Change how it's split right in the expense form.                   | ¿Un gasto va distinto? Cambia cómo se reparte en el propio formulario.                                               |
| `wakeUp.tips.settleUp`       | Paid someone back? Record the payment and everyone's balance updates.                             | ¿Le has devuelto dinero a alguien? Registra el pago y los saldos se actualizan para todos.                           |
| `wakeUp.tips.fixMistakes`    | Got an expense wrong? Open it to edit or delete it.                                               | ¿Te has equivocado en un gasto? Ábrelo para editarlo o borrarlo.                                                     |
| `wakeUp.tips.guests`         | Guests can see everything but change nothing. Handy for someone staying a while.                  | Las personas invitadas lo ven todo pero no cambian nada. Ideal para quien se queda una temporada.                    |
| `wakeUp.tips.movedOut`       | When someone moves out, their past expenses stay in the history.                                  | Cuando alguien se muda, sus gastos pasados se quedan en el historial.                                                |
| `wakeUp.tips.darkTheme`      | Prefer it darker? Switch to the dark theme from your account menu.                                | ¿Lo prefieres oscuro? Cambia al tema oscuro desde el menú de tu cuenta.                                              |
| `wakeUp.tips.language`       | Hogar speaks English and Spanish. Switch any time from your account menu.                         | Hogar habla español e inglés. Cámbialo cuando quieras desde el menú de tu cuenta.                                    |
| `wakeUp.slow.title`          | This is taking longer than usual                                                                  | Esto está tardando más de lo normal                                                                                  |
| `wakeUp.slow.description`    | Your home may still be waking up. Give it another go in a moment.                                 | Puede que tu hogar siga despertándose. Vuelve a intentarlo en un momento.                                            |
| `wakeUp.retry`               | Try again                                                                                         | Intentarlo de nuevo                                                                                                  |
| `wakeUp.offline.title`       | You seem to be offline                                                                            | Parece que no tienes conexión                                                                                        |
| `wakeUp.offline.description` | We'll carry on as soon as you're back online.                                                     | Seguiremos en cuanto vuelvas a tener conexión.                                                                       |

Before implementing each tip, check in the app that the feature and its wording ("household
settings", "account menu", the guest role) match what the UI actually shows.
