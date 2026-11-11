import {
  canEditContent,
  expenseInputSchema,
  MAX_AMOUNT_CENTS,
  splitAmount,
  type ErrorCode,
  type HouseholdView,
} from "@hogar/shared";
import { Alert, Amount, Avatar, Button, ChoiceGroup, Select, Spinner, TextField } from "@hogar/ui";
import { ArrowLeft } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { errorKey } from "../../api/client";
import { useCurrentUser } from "../../auth/guards";
import { parseAmount } from "../../expenses/money";
import { useCreateExpense } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { memberColor } from "../../household/members";
import { useHousehold } from "../../household/useHousehold";
import { localToday, useList, usePercent } from "../../i18n/format";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./ExpenseFormPage.module.css";

type Field = "description" | "amount" | "date";
type FieldErrors = Partial<Record<Field, ErrorCode>>;

const FIELD_OF: Record<string, Field> = { description: "description", amountCents: "amount", date: "date" };

/** The first error code for each field, from a failed schema check. */
function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = FIELD_OF[String(issue.path[0])];
    if (field && !errors[field]) errors[field] = issue.message as ErrorCode;
  }
  return errors;
}

/** Adding an expense: what, how much, who paid, when, and how it's split. */
export function ExpenseFormPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const household = useHousehold();

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;
  if (current && !canEditContent(current.myRole)) return <Navigate to="/expenses" replace />;

  return (
    <AppShell>
      <div className={styles.heading}>
        <ActionLink to="/expenses" variant="ghost" icon={<ArrowLeft />} className={styles.back}>
          {t("form.back")}
        </ActionLink>
        <h1 className={styles.title}>{t("form.newTitle")}</h1>
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && <ExpenseForm household={current} />
      )}
    </AppShell>
  );
}

function ExpenseForm({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["expenses", "errors"]);
  const user = useCurrentUser();
  const navigate = useNavigate();
  const percent = usePercent();
  const list = useList();
  const create = useCreateExpense();
  const previewId = useId();

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidById, setPaidById] = useState(user.id);
  const [date, setDate] = useState(localToday);
  const [errors, setErrors] = useState<FieldErrors>({});

  const sharing = household.members.filter((member) => member.weight > 0);
  const nobodyPays = sharing.length === 0;
  const cents = parseAmount(amountText);
  const preview =
    cents !== null && cents > 0 && cents <= MAX_AMOUNT_CENTS && !nobodyPays
      ? splitAmount(
          cents,
          sharing.map((member) => member.weight),
        )
      : null;

  const error = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = expenseInputSchema.safeParse({
      description,
      amountCents: parseAmount(amountText) ?? Number.NaN,
      paidById,
      date,
      split: { method: "WEIGHTS" },
    });
    if (!result.success) {
      setErrors(fieldErrors(result.error.issues));
      return;
    }
    setErrors({});
    create.mutate(result.data, {
      onSuccess: (expense) => void navigate(`/expenses/${expense.id}`, { state: { saved: true } }),
    });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {create.isError && <Alert tone="danger">{t(errorKey(create.error))}</Alert>}
      <TextField
        label={t("form.description")}
        hint={t("form.descriptionHint")}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={error("description")}
        autoComplete="off"
      />
      <TextField
        label={t("form.amount")}
        hint={t("form.amountHint")}
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={(event) => setAmountText(event.target.value)}
        error={error("amount")}
      />
      <Select
        label={t("form.paidBy")}
        options={household.members.map((member) => ({ value: member.userId, label: member.name }))}
        value={paidById}
        onChange={(event) => setPaidById(event.target.value)}
      />
      <TextField
        type="date"
        label={t("form.date")}
        value={date}
        max={localToday()}
        onChange={(event) => setDate(event.target.value)}
        error={error("date")}
      />

      <div className={styles.split}>
        <ChoiceGroup
          legend={t("form.split.legend")}
          name="split"
          value="WEIGHTS"
          onChange={() => {}}
          options={[
            {
              value: "WEIGHTS",
              label: t("form.split.weights"),
              hint: nobodyPays
                ? t("form.split.noDefault")
                : list(sharing.map((member) => `${member.name} ${percent(member.shareBps)}`)),
              disabled: nobodyPays,
            },
          ]}
        />
        {nobodyPays && (
          <ActionLink to="/household/settings#split" variant="ghost" className={styles.reviewSplit}>
            {t("form.split.reviewSplit")}
          </ActionLink>
        )}
      </div>

      {preview && (
        <section className={styles.preview} aria-labelledby={previewId}>
          <h2 id={previewId} className={styles.previewTitle}>
            {t("form.split.preview")}
          </h2>
          <ul className={styles.shares} aria-labelledby={previewId}>
            {sharing.map((member, index) => (
              <li key={member.id} className={styles.share}>
                <Avatar
                  size="sm"
                  decorative
                  name={member.name}
                  src={member.avatarUrl}
                  colorIndex={memberColor(household.members.indexOf(member))}
                />
                <span className={styles.shareName}>{member.name}</span>
                <Amount cents={preview[index] ?? 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.actions}>
        <ActionLink to="/expenses" variant="ghost">
          {t("form.cancel")}
        </ActionLink>
        <Button type="submit" loading={create.isPending} loadingLabel={t("form.saving")}>
          {t("form.save")}
        </Button>
      </div>
    </form>
  );
}
