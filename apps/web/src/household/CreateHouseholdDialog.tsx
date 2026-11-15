import {
  CURRENCY_CODES,
  createHouseholdRequestSchema,
  errorCodeFrom,
  suggestCurrency,
  type CurrencyCode,
} from "@hogar/shared";
import { Button, Dialog, Select, TextField, useLocale } from "@hogar/ui";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";
import styles from "./CreateHouseholdDialog.module.css";
import { useCreateHousehold } from "./useHousehold";

export interface CreateHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The currency a new household starts with: whatever people spend in the device's region. */
const suggestedCurrency = () => suggestCurrency(navigator.languages);

/**
 * Asks for a name and a currency: the creator becomes the household's admin. Currency names
 * come from `Intl.DisplayNames` in the active language ("Colombian peso" / "peso colombiano"),
 * sorted the way that language sorts, so nobody needs to know ISO codes.
 */
export function CreateHouseholdDialog({ open, onOpenChange }: CreateHouseholdDialogProps) {
  const { t } = useTranslation(["household", "errors"]);
  const formId = useId();
  const field = useRef<HTMLInputElement>(null);
  const create = useCreateHousehold();
  const locale = useLocale();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(suggestedCurrency);
  const [fieldError, setFieldError] = useState<string>();
  const currencyOptions = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: "currency" });
    return CURRENCY_CODES.map((code) => ({ value: code, label: names.of(code) ?? code })).sort((a, b) =>
      a.label.localeCompare(b.label, locale),
    );
  }, [locale]);

  function changeOpen(next: boolean) {
    if (!next) {
      setName("");
      setCurrency(suggestedCurrency());
      setFieldError(undefined);
      create.reset();
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Same schema as the API, so the person hears about a problem before any request.
    const parsed = createHouseholdRequestSchema.safeParse({ name, currency });
    if (!parsed.success) {
      setFieldError(t(`errors:${errorCodeFrom(parsed.error)}`));
      // Back to the field, so screen readers announce the error right where it can be fixed.
      field.current?.focus();
      return;
    }
    setFieldError(undefined);
    create.mutate(parsed.data, {
      onSuccess: () => onOpenChange(false),
      onError: () => field.current?.focus(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title={t("create.title")}
      description={t("create.description")}
      closeLabel={t("close")}
      initialFocus={field}
      actions={
        <>
          <Button variant="secondary" onClick={() => changeOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending} loadingLabel={t("create.submitting")}>
            {t("create.submit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className={styles.form}>
        <TextField
          ref={field}
          label={t("create.nameLabel")}
          hint={t("create.nameHint")}
          error={fieldError ?? (create.isError ? t(errorKey(create.error)) : undefined)}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <Select
          label={t("create.currencyLabel")}
          hint={t("create.currencyHint")}
          options={currencyOptions}
          value={currency}
          onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
        />
      </form>
    </Dialog>
  );
}
