import type { HouseholdView } from "@hogar/shared";
import { Alert, Button, Card, Checkbox } from "@hogar/ui";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { useSetShowWhoAsked } from "../../household/useHousehold";
import styles from "./HouseholdSettingsPage.module.css";

/**
 * How the shopping list works for the whole household; only admins see it. "Who asked" helps in the
 * shop, but if it ever feels like keeping score an admin can hide it for everyone. Hiding deletes
 * nothing, so showing it again brings every name back.
 */
export function ShoppingSection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const save = useSetShowWhoAsked();
  // Follows the household (another admin may change it) until this admin ticks or unticks the box.
  const [picked, setPicked] = useState<boolean | null>(null);
  const showWhoAsked = picked ?? household.showWhoAsked;

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(showWhoAsked, { onSuccess: () => setPicked(null) });
  }

  return (
    <Card as="section" padding="lg" aria-labelledby="settings-shopping" className={styles.section}>
      <h2 id="settings-shopping" className={styles.sectionTitle}>
        {t("settings.shopping.title")}
      </h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Checkbox
          label={t("settings.shopping.showWhoAsked")}
          hint={t("settings.shopping.showWhoAskedHint")}
          checked={showWhoAsked}
          onChange={(event) => {
            setPicked(event.target.checked);
            save.reset();
          }}
        />
        {save.isError && <Alert tone="danger">{t(errorKey(save.error))}</Alert>}
        <div className={styles.row}>
          <Button
            type="submit"
            variant="secondary"
            loading={save.isPending}
            loadingLabel={t("settings.shopping.saving")}
            disabled={showWhoAsked === household.showWhoAsked}
          >
            {t("settings.shopping.save")}
          </Button>
          {save.isSuccess && (
            <p className={styles.saved} role="status">
              <Check aria-hidden="true" size="1em" /> {t("settings.shopping.saved")}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
