import { currencyCodeSchema, type CurrencyCode, type HouseholdView } from "@hogar/shared";
import { Button, Card, Select } from "@hogar/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, errorKey } from "../../api/client";
import { useCurrencyName, useCurrencyOptions } from "../../household/useCurrencyOptions";
import { householdKeys, useChangeCurrency } from "../../household/useHousehold";
import styles from "./HouseholdSettingsPage.module.css";

/**
 * The household's currency (ADR 0011): an admin can change it until the first expense or payment,
 * since after that a change would silently change what every stored amount means. Then it is
 * shown fixed, with why; members and guests always see it read-only.
 */
export function CurrencySection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const queryClient = useQueryClient();
  const change = useChangeCurrency();
  const options = useCurrencyOptions();
  const nameOf = useCurrencyName();
  const [currency, setCurrency] = useState<CurrencyCode>(household.currency);
  const field = useRef<HTMLSelectElement>(null);
  const lockedHint = useRef<HTMLParagraphElement>(null);
  const [lockedWhileChoosing, setLockedWhileChoosing] = useState(false);
  const isAdmin = household.myRole === "ADMIN";
  const editable = isAdmin && !household.currencyLocked;

  // Someone recorded money while the admin was choosing: the select is gone, so focus moves to
  // the explanation and screen readers announce why the currency can no longer change.
  useEffect(() => {
    if (lockedWhileChoosing && household.currencyLocked) lockedHint.current?.focus();
  }, [lockedWhileChoosing, household.currencyLocked]);

  function submit(event: FormEvent) {
    event.preventDefault();
    change.mutate(currency, {
      onSuccess: (updated) => setCurrency(updated.currency),
      onError: (error) => {
        if (error instanceof ApiRequestError && error.code === "household.currency.locked") {
          setLockedWhileChoosing(true);
          void queryClient.invalidateQueries({ queryKey: householdKeys.current });
          return;
        }
        field.current?.focus();
      },
    });
  }

  return (
    <Card as="section" padding="lg" aria-labelledby="settings-currency" className={styles.section}>
      <h2 id="settings-currency" className={styles.sectionTitle}>
        {t("settings.currency.title")}
      </h2>
      {editable ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <Select
            ref={field}
            label={t("settings.currency.label")}
            options={options}
            value={currency}
            onChange={(event) => {
              const picked = currencyCodeSchema.safeParse(event.target.value);
              if (picked.success) setCurrency(picked.data);
              change.reset();
            }}
            error={change.isError && !lockedWhileChoosing ? t(errorKey(change.error)) : undefined}
          />
          <div className={styles.row}>
            <Button
              type="submit"
              variant="secondary"
              loading={change.isPending}
              loadingLabel={t("settings.currency.saving")}
              disabled={currency === household.currency}
            >
              {t("settings.currency.save")}
            </Button>
            {change.isSuccess && (
              <p className={styles.saved} role="status">
                <Check aria-hidden="true" size="1em" /> {t("settings.currency.saved")}
              </p>
            )}
          </div>
        </form>
      ) : (
        <>
          <p className={styles.householdName}>{nameOf(household.currency)}</p>
          <p ref={lockedHint} tabIndex={-1} className={styles.muted}>
            {isAdmin ? t("settings.currency.locked") : t("settings.currency.readOnly")}
          </p>
        </>
      )}
    </Card>
  );
}
