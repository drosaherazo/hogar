import { errorCodeFrom, householdNameSchema, type HouseholdView } from "@hogar/shared";
import { Button, Card, TextField } from "@hogar/ui";
import { Check } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { useRenameHousehold } from "../../household/useHousehold";
import styles from "./HouseholdSettingsPage.module.css";

/** The household's name: editable by admins, read-only for everyone else. */
export function NameSection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const rename = useRenameHousehold();
  const [name, setName] = useState(household.name);
  const [fieldError, setFieldError] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const isAdmin = household.myRole === "ADMIN";

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(t(`errors:${errorCodeFrom(parsed.error)}`));
      field.current?.focus();
      return;
    }
    setFieldError(undefined);
    rename.mutate(parsed.data, {
      onSuccess: (updated) => setName(updated.name),
      onError: () => field.current?.focus(),
    });
  }

  return (
    <Card as="section" padding="lg" aria-labelledby="settings-name" className={styles.section}>
      <h2 id="settings-name" className={styles.sectionTitle}>
        {t("settings.name.title")}
      </h2>
      {isAdmin ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            ref={field}
            label={t("settings.name.label")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              rename.reset();
            }}
            error={fieldError ?? (rename.isError ? t(errorKey(rename.error)) : undefined)}
            autoComplete="off"
          />
          <div className={styles.row}>
            <Button
              type="submit"
              variant="secondary"
              loading={rename.isPending}
              loadingLabel={t("settings.name.saving")}
              disabled={name.trim() === household.name}
            >
              {t("settings.name.save")}
            </Button>
            {rename.isSuccess && (
              <p className={styles.saved} role="status">
                <Check aria-hidden="true" size="1em" /> {t("settings.name.saved")}
              </p>
            )}
          </div>
        </form>
      ) : (
        <>
          <p className={styles.householdName}>{household.name}</p>
          <p className={styles.muted}>{t("settings.name.readOnly")}</p>
        </>
      )}
    </Card>
  );
}
