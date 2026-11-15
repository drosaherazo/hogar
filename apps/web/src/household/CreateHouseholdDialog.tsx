import {
  CURRENCY_CODES,
  createHouseholdRequestSchema,
  currencyCodeSchema,
  suggestCurrency,
  type CurrencyCode,
  type ErrorCode,
} from "@hogar/shared";
import { Button, Dialog, Select, TextField, useLocale } from "@hogar/ui";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError } from "../api/client";
import styles from "./CreateHouseholdDialog.module.css";
import { useCreateHousehold } from "./useHousehold";

export interface CreateHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The currency a new household starts with: whatever people spend in the device's region. */
const suggestedCurrency = () => suggestCurrency(navigator.languages);

type Field = "name" | "currency";
/** What the schema or the API answered: an error code, or a request that never got through. */
type Code = ApiRequestError["code"];
type FieldErrors = Partial<Record<Field, Code>>;

/** Which field an error code belongs to, so it is shown (and focused) where it can be fixed. */
const fieldOf = (code: Code): Field => (code === "money.currency.invalid" ? "currency" : "name");

/**
 * Asks for a name and a currency: the creator becomes the household's admin. Currency names
 * come from `Intl.DisplayNames` in the active language ("Colombian peso" / "peso colombiano"),
 * sorted the way that language sorts, so nobody needs to know ISO codes.
 */
export function CreateHouseholdDialog({ open, onOpenChange }: CreateHouseholdDialogProps) {
  const { t } = useTranslation(["household", "errors"]);
  const formId = useId();
  const nameField = useRef<HTMLInputElement>(null);
  const currencyField = useRef<HTMLSelectElement>(null);
  const create = useCreateHousehold();
  const locale = useLocale();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(suggestedCurrency);
  const [errors, setErrors] = useState<FieldErrors>({});
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
      setErrors({});
      create.reset();
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Same schema as the API, so the person hears about a problem before any request.
    const parsed = createHouseholdRequestSchema.safeParse({ name, currency });
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === "currency" ? "currency" : "name";
        found[field] ??= issue.message as ErrorCode;
      }
      show(found);
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => onOpenChange(false),
      onError: (error) => {
        const code = error instanceof ApiRequestError ? error.code : "server.unexpected";
        show({ [fieldOf(code)]: code });
      },
    });
  }

  function show(found: FieldErrors) {
    setErrors(found);
    // Back to the first wrong field, so screen readers announce the error where it can be fixed.
    (found.name ? nameField : currencyField).current?.focus();
  }

  const errorText = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title={t("create.title")}
      description={t("create.description")}
      closeLabel={t("close")}
      initialFocus={nameField}
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
          ref={nameField}
          label={t("create.nameLabel")}
          hint={t("create.nameHint")}
          error={errorText("name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <Select
          ref={currencyField}
          label={t("create.currencyLabel")}
          hint={t("create.currencyHint")}
          options={currencyOptions}
          value={currency}
          onChange={(event) => {
            const picked = currencyCodeSchema.safeParse(event.target.value);
            if (picked.success) setCurrency(picked.data);
          }}
          error={errorText("currency")}
        />
      </form>
    </Dialog>
  );
}
