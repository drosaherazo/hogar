import {
  canEditContent,
  expenseInputSchema,
  MAX_AMOUNT_CENTS,
  SPLIT_METHODS,
  splitAmount,
  type ErrorCode,
  type ExpenseSplitInput,
  type HouseholdView,
  type SplitMethod,
} from "@hogar/shared";
import { Alert, Amount, Avatar, Button, ChoiceGroup, Select, Spinner, TextField } from "@hogar/ui";
import { ArrowLeft, CircleAlert } from "lucide-react";
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
import { localToday, useList, useMoney, usePercent } from "../../i18n/format";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./ExpenseFormPage.module.css";

type Field = "description" | "amount" | "date" | "split";
type FieldErrors = Partial<Record<Field, ErrorCode>>;

const FIELD_OF: Record<string, Field> = {
  description: "description",
  amountCents: "amount",
  date: "date",
  split: "split",
};

/** The first error code for each field, from a failed schema check. */
function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = FIELD_OF[String(issue.path[0])];
    if (field && !errors[field]) errors[field] = issue.message as ErrorCode;
  }
  return errors;
}

const isValidAmount = (cents: number | null): cents is number =>
  cents !== null && cents >= 1 && cents <= MAX_AMOUNT_CENTS;

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
  const money = useMoney();
  const create = useCreateExpense();
  const previewId = useId();
  const splitErrorId = useId();

  const { members } = household;
  const sharing = members.filter((member) => member.weight > 0);
  const nobodyPays = sharing.length === 0;

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidById, setPaidById] = useState(user.id);
  const [date, setDate] = useState(localToday);
  const [method, setMethod] = useState<SplitMethod>(nobodyPays ? "EQUAL" : "WEIGHTS");
  const [chosen, setChosen] = useState<string[]>(() => members.map((member) => member.userId));
  const [exactTexts, setExactTexts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});

  const cents = parseAmount(amountText);
  const amount = isValidAmount(cents) ? cents : null;

  // The household's split: a live preview with the same function the API uses.
  const weightShares =
    amount !== null && !nobodyPays
      ? splitAmount(
          amount,
          sharing.map((member) => member.weight),
        )
      : null;

  // Equally among the chosen people, in member order.
  const chosenMembers = members.filter((member) => chosen.includes(member.userId));
  const equalShares =
    amount !== null && chosenMembers.length > 0
      ? splitAmount(
          amount,
          chosenMembers.map(() => 1),
        )
      : null;

  // Exact amounts: empty fields count as €0.00; anything unreadable blocks saving.
  const exactCents = members.map((member) => {
    const text = exactTexts[member.userId]?.trim() ?? "";
    return text === "" ? 0 : parseAmount(text);
  });
  const exactReadable = exactCents.every((value) => value !== null);
  const remaining =
    amount !== null && exactReadable ? amount - exactCents.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

  function splitInput(): ExpenseSplitInput {
    if (method === "EQUAL") return { method, userIds: chosenMembers.map((member) => member.userId) };
    if (method === "EXACT") {
      return {
        method,
        shares: members.flatMap((member, index) =>
          (exactTexts[member.userId]?.trim() ?? "") === ""
            ? []
            : [{ userId: member.userId, amountCents: exactCents[index] ?? Number.NaN }],
        ),
      };
    }
    return { method: "WEIGHTS" };
  }

  const error = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = expenseInputSchema.safeParse({
      description,
      amountCents: cents ?? Number.NaN,
      paidById,
      date,
      split: splitInput(),
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
        options={members.map((member) => ({ value: member.userId, label: member.name }))}
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
          value={method}
          onChange={(value) => setMethod(SPLIT_METHODS.find((option) => option === value) ?? "WEIGHTS")}
          options={[
            {
              value: "WEIGHTS",
              label: t("form.split.weights"),
              hint: nobodyPays
                ? t("form.split.noDefault")
                : list(sharing.map((member) => `${member.name} ${percent(member.shareBps)}`)),
              disabled: nobodyPays,
            },
            { value: "EQUAL", label: t("form.split.equal") },
            { value: "EXACT", label: t("form.split.exact") },
          ]}
        />
        {nobodyPays && (
          <ActionLink to="/household/settings#split" variant="ghost" className={styles.reviewSplit}>
            {t("form.split.reviewSplit")}
          </ActionLink>
        )}
      </div>

      {method === "WEIGHTS" && weightShares && (
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
                  colorIndex={memberColor(members.indexOf(member))}
                />
                <span className={styles.shareName}>{member.name}</span>
                <Amount cents={weightShares[index] ?? 0} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {method === "EQUAL" && (
        <div className={styles.split}>
          <ChoiceGroup
            multiple
            legend={t("form.split.who")}
            name="equal"
            value={chosen}
            onChange={setChosen}
            options={members.map((member) => {
              const index = chosenMembers.indexOf(member);
              return {
                value: member.userId,
                label: member.name,
                trailing: equalShares && index >= 0 ? <Amount cents={equalShares[index] ?? 0} /> : undefined,
              };
            })}
          />
          {errors.split && (
            <p id={splitErrorId} className={styles.splitError}>
              <CircleAlert aria-hidden="true" className={styles.splitErrorIcon} />
              {t(`errors:${errors.split}`)}
            </p>
          )}
        </div>
      )}

      {method === "EXACT" && (
        <fieldset className={styles.exact}>
          <legend className={styles.exactLegend}>{t("form.split.amounts")}</legend>
          {members.map((member) => (
            <TextField
              key={member.id}
              inline
              label={member.name}
              inputMode="decimal"
              autoComplete="off"
              value={exactTexts[member.userId] ?? ""}
              onChange={(event) => setExactTexts((texts) => ({ ...texts, [member.userId]: event.target.value }))}
            />
          ))}
          <p className={styles.remaining} aria-live="polite">
            {remaining !== null && remaining > 0 && t("form.split.left", { amount: money(remaining) })}
            {remaining !== null && remaining < 0 && t("form.split.over", { amount: money(-remaining) })}
          </p>
          {errors.split && (
            <p className={styles.splitError}>
              <CircleAlert aria-hidden="true" className={styles.splitErrorIcon} />
              {t(`errors:${errors.split}`)}
            </p>
          )}
        </fieldset>
      )}

      <div className={styles.actions}>
        <ActionLink to="/expenses" variant="ghost">
          {t("form.cancel")}
        </ActionLink>
        <Button
          type="submit"
          loading={create.isPending}
          loadingLabel={t("form.saving")}
          disabled={method === "EXACT" && remaining !== 0}
        >
          {t("form.save")}
        </Button>
      </div>
    </form>
  );
}
