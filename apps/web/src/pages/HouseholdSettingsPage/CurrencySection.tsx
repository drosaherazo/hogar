import { currencyCodeSchema, type CurrencyCode, type HouseholdView } from "@hogar/shared";
import { Button, Card, Combobox } from "@hogar/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, errorKey } from "../../api/client";
import { useCurrencyName, useCurrencySearch } from "../../household/useCurrencySearch";
import { householdKeys, useChangeCurrency } from "../../household/useHousehold";
import styles from "./HouseholdSettingsPage.module.css";

/**
 * The household's currency (ADRs 0011, 0014): an admin can change it until the first expense or payment,
 * since after that a change would silently change what every stored amount means. Then it is
 * shown fixed, with why; members and guests always see it read-only.
 */
export function CurrencySection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const queryClient = useQueryClient();
  const change = useChangeCurrency();
  const searchCurrencies = useCurrencySearch(household.currency);
  const nameOf = useCurrencyName();
  // Follows the household (a reload may bring another admin's change) until the admin picks one.
  const [picked, setPicked] = useState<CurrencyCode | null>(null);
  const currency = picked ?? household.currency;
  const field = useRef<HTMLInputElement>(null);
  const lockedHint = useRef<HTMLParagraphElement>(null);
  const [lockedWhileChoosing, setLockedWhileChoosing] = useState(false);
  const isAdmin = household.myRole === "ADMIN";
  const editable = isAdmin && !household.currencyLocked;

  // Someone recorded money while the admin was choosing: the field is gone, so focus moves to
  // the explanation and screen readers announce why the currency can no longer change.
  useEffect(() => {
    if (lockedWhileChoosing && household.currencyLocked) lockedHint.current?.focus();
  }, [lockedWhileChoosing, household.currencyLocked]);

  function submit(event: FormEvent) {
    event.preventDefault();
    change.mutate(currency, {
      onSuccess: () => setPicked(null),
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
          <Combobox
            inputRef={field}
            label={t("settings.currency.label")}
            hint={t("currencyPicker.searchHint")}
            search={searchCurrencies}
            selectedId={currency}
            onSelectionChange={(id) => {
              const choice = currencyCodeSchema.safeParse(id);
              if (choice.success) setPicked(choice.data);
              change.reset();
            }}
            noResults={(query) => t("currencyPicker.noResults", { query })}
            triggerLabel={t("currencyPicker.showAll")}
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
