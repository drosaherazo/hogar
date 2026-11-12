import {
  canEditContent,
  expenseInputSchema,
  MAX_AMOUNT_CENTS,
  SPLIT_METHODS,
  splitAmount,
  weightsToBasisPoints,
  type ErrorCode,
  type ExpenseSplitInput,
  type ExpenseView,
  type HouseholdView,
  type PersonRef,
  type SplitMethod,
} from "@hogar/shared";
import { Alert, Amount, Avatar, Button, ChoiceGroup, Select, Spinner, TextField, useLocale } from "@hogar/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";
import { ApiRequestError, errorKey } from "../../api/client";
import { useCurrentUser } from "../../auth/guards";
import { amountInputValue, parseAmount } from "../../expenses/money";
import { avatarPropsFor, usePersonLabel } from "../../expenses/people";
import { useCreateExpense, useExpense, useUpdateExpense } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { householdKeys, useHousehold } from "../../household/useHousehold";
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

/** Adding an expense (`/expenses/new`) or editing one (`/expenses/:id/edit`). */
export function ExpenseFormPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const { id } = useParams();
  const household = useHousehold();
  const editing = id !== undefined;

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;
  if (current && !canEditContent(current.myRole)) {
    return <Navigate to={editing ? `/expenses/${id}` : "/expenses"} replace />;
  }

  return (
    <AppShell>
      <div className={styles.heading}>
        <ActionLink
          to={editing ? `/expenses/${id}` : "/expenses"}
          variant="ghost"
          icon={<ArrowLeft />}
          className={styles.back}
        >
          {editing ? t("form.backToExpense") : t("form.back")}
        </ActionLink>
        <h1 className={styles.title}>{editing ? t("form.editTitle") : t("form.newTitle")}</h1>
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && (editing ? <EditExpense id={id} household={current} /> : <ExpenseForm household={current} />)
      )}
    </AppShell>
  );
}

/**
 * Loads the expense and edits it. If someone else saved a newer version meanwhile, the save is
 * refused: this says so, loads the latest version and starts the form again from it.
 */
function EditExpense({ id, household }: { id: string; household: HouseholdView }) {
  const { t } = useTranslation(["expenses", "errors", "common"]);
  const expense = useExpense(id);
  const [conflict, setConflict] = useState(false);

  if (expense.isPending) return <Spinner label={t("common:loading")} />;
  if (expense.isError) return <Alert tone="danger">{t(errorKey(expense.error))}</Alert>;
  return (
    <>
      {conflict && <Alert tone="danger">{t("errors:expense.changed")}</Alert>}
      <ExpenseForm
        key={expense.data.version}
        household={household}
        existing={expense.data}
        onConflict={() => {
          setConflict(true);
          void expense.refetch();
        }}
      />
    </>
  );
}

interface ExpenseFormProps {
  household: HouseholdView;
  /** The expense being edited; omitted when adding one. */
  existing?: ExpenseView | undefined;
  onConflict?: (() => void) | undefined;
}

function ExpenseForm({ household, existing, onConflict }: ExpenseFormProps) {
  const { t } = useTranslation(["expenses", "errors"]);
  const user = useCurrentUser();
  const locale = useLocale();
  const navigate = useNavigate();
  const percent = usePercent();
  const list = useList();
  const money = useMoney();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const save = existing ? update : create;
  const previewId = useId();
  const personLabel = usePersonLabel();
  const queryClient = useQueryClient();

  const { members } = household;
  const sharing = members.filter((member) => member.weight > 0);
  const nobodyPays = sharing.length === 0;

  // People who can appear in this expense: current members, plus former members already in it.
  const memberRefs: PersonRef[] = members.map((member) => ({
    userId: member.userId,
    name: member.name,
    avatarUrl: member.avatarUrl,
    former: false,
  }));
  const formerInExpense = existing
    ? [existing.paidBy, ...existing.split.shares.map((share) => share.person)].filter(
        (person, index, all) => person.former && all.findIndex((other) => other.userId === person.userId) === index,
      )
    : [];
  const people = [...memberRefs, ...formerInExpense];

  // An expense saved with the household's split keeps its proportions; shown as such.
  const savedShares = existing?.split.method === "WEIGHTS" ? existing.split.shares : null;

  const [description, setDescription] = useState(existing?.description ?? "");
  const [amountText, setAmountText] = useState(existing ? amountInputValue(existing.amountCents, locale) : "");
  const [paidById, setPaidById] = useState(existing?.paidBy.userId ?? user.id);
  const [date, setDate] = useState(existing?.date ?? localToday());
  const [method, setMethod] = useState<SplitMethod>(existing?.split.method ?? (nobodyPays ? "EQUAL" : "WEIGHTS"));
  const [chosen, setChosen] = useState<string[]>(() =>
    existing?.split.method === "EQUAL"
      ? existing.split.shares.map((share) => share.person.userId)
      : members.map((member) => member.userId),
  );
  const [exactTexts, setExactTexts] = useState<Record<string, string>>(() =>
    existing?.split.method === "EXACT"
      ? Object.fromEntries(
          existing.split.shares.map((share) => [share.person.userId, amountInputValue(share.amountCents, locale)]),
        )
      : {},
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const cents = parseAmount(amountText);
  const amount = isValidAmount(cents) ? cents : null;

  // The default split with today's weights, computed with the same function the API uses. These
  // are the shares the API checks before saving fresh default shares (research R3).
  function freshSharesFor(total: number | null): { person: PersonRef; amountCents: number }[] | null {
    if (total === null || nobodyPays) return null;
    const amounts = splitAmount(
      total,
      sharing.map((member) => member.weight),
    );
    return sharing.map((member, index) => ({
      person: { userId: member.userId, name: member.name, avatarUrl: member.avatarUrl, former: false },
      amountCents: amounts[index] ?? 0,
    }));
  }

  // A live preview of the default split. A saved expense keeps its proportions (same amount,
  // same shares; new amount, rescaled); otherwise today's weights.
  function weightPreviewFor(total: number | null): { person: PersonRef; amountCents: number }[] | null {
    if (total === null) return null;
    if (savedShares) {
      const saved = savedShares.map((share) => share.amountCents);
      const amounts = total === existing?.amountCents ? saved : splitAmount(total, saved);
      return savedShares.map((share, index) => ({ person: share.person, amountCents: amounts[index] ?? 0 }));
    }
    return freshSharesFor(total);
  }
  const weightPreview = weightPreviewFor(amount);

  // Equally among the chosen people, in order.
  const chosenPeople = people.filter((person) => chosen.includes(person.userId));
  const equalShares =
    amount !== null && chosenPeople.length > 0
      ? splitAmount(
          amount,
          chosenPeople.map(() => 1),
        )
      : null;

  // Exact amounts: empty fields count as €0.00; anything unreadable blocks saving.
  const exactCents = people.map((person) => {
    const text = exactTexts[person.userId]?.trim() ?? "";
    return text === "" ? 0 : parseAmount(text);
  });
  const exactReadable = exactCents.every((value) => value !== null);
  const remaining =
    amount !== null && exactReadable ? amount - exactCents.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

  function splitInput(): ExpenseSplitInput {
    if (method === "EQUAL") return { method, userIds: chosenPeople.map((person) => person.userId) };
    if (method === "EXACT") {
      return {
        method,
        shares: people.flatMap((person, index) =>
          (exactTexts[person.userId]?.trim() ?? "") === ""
            ? []
            : [{ userId: person.userId, amountCents: exactCents[index] ?? Number.NaN }],
        ),
      };
    }
    // Fresh default shares (a new expense, or one switched to the default split) carry the
    // previewed shares; an expense that keeps its saved shares sends none.
    if (savedShares) return { method: "WEIGHTS" };
    const preview = freshSharesFor(amount);
    return preview
      ? {
          method: "WEIGHTS",
          previewShares: preview.map((share) => ({ userId: share.person.userId, amountCents: share.amountCents })),
        }
      : { method: "WEIGHTS" };
  }

  const error = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };
  const isConflict = save.error instanceof ApiRequestError && save.error.code === "expense.changed";

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
    const done = (saved: ExpenseView) => void navigate(`/expenses/${saved.id}`, { state: { saved: true } });
    // The weights changed since the preview: fetch them again, so the form shows the new shares
    // next to the message and the person can save again.
    const refreshSplit = (failure: Error) => {
      if (failure instanceof ApiRequestError && failure.code === "expense.split.changed") {
        void queryClient.invalidateQueries({ queryKey: householdKeys.current });
      }
    };
    if (existing) {
      update.mutate(
        { id: existing.id, input: { ...result.data, version: existing.version } },
        {
          onSuccess: done,
          onError: (failure) => {
            if (failure instanceof ApiRequestError && failure.code === "expense.changed") onConflict?.();
            refreshSplit(failure);
          },
        },
      );
    } else {
      create.mutate(result.data, { onSuccess: done, onError: refreshSplit });
    }
  }

  const weightsOption = savedShares
    ? {
        value: "WEIGHTS",
        label: t("form.split.weightsSaved", {
          shares: list(
            savedShares.map((share, index) => {
              const bps = weightsToBasisPoints(savedShares.map((entry) => entry.amountCents))[index] ?? 0;
              return `${share.person.name} ${percent(bps)}`;
            }),
          ),
        }),
      }
    : {
        value: "WEIGHTS",
        label: t("form.split.weights"),
        hint: nobodyPays
          ? t("form.split.noDefault")
          : list(sharing.map((member) => `${member.name} ${percent(member.shareBps)}`)),
        disabled: nobodyPays,
      };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {save.isError && !isConflict && <Alert tone="danger">{t(errorKey(save.error))}</Alert>}
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
        options={people.map((person) => ({ value: person.userId, label: personLabel(person) }))}
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
            weightsOption,
            { value: "EQUAL", label: t("form.split.equal") },
            { value: "EXACT", label: t("form.split.exact") },
          ]}
        />
        {nobodyPays && !savedShares && (
          <ActionLink to="/household/settings#split" variant="ghost" className={styles.reviewSplit}>
            {t("form.split.reviewSplit")}
          </ActionLink>
        )}
      </div>

      {method === "WEIGHTS" && weightPreview && (
        <section className={styles.preview} aria-labelledby={previewId}>
          <h2 id={previewId} className={styles.previewTitle}>
            {t("form.split.preview")}
          </h2>
          <ul className={styles.shares} aria-labelledby={previewId}>
            {weightPreview.map(({ person, amountCents }) => (
              <li key={person.userId} className={styles.share}>
                <Avatar size="sm" decorative {...avatarPropsFor(person, members)} />
                <span className={styles.shareName}>{person.name}</span>
                <Amount cents={amountCents} />
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
            options={people.map((person) => {
              const index = chosenPeople.indexOf(person);
              return {
                value: person.userId,
                label: personLabel(person),
                trailing: equalShares && index >= 0 ? <Amount cents={equalShares[index] ?? 0} /> : undefined,
              };
            })}
          />
          {errors.split && <SplitError code={errors.split} />}
        </div>
      )}

      {method === "EXACT" && (
        <fieldset className={styles.exact}>
          <legend className={styles.exactLegend}>{t("form.split.amounts")}</legend>
          {people.map((person) => (
            <TextField
              key={person.userId}
              inline
              label={personLabel(person)}
              inputMode="decimal"
              autoComplete="off"
              value={exactTexts[person.userId] ?? ""}
              onChange={(event) => setExactTexts((texts) => ({ ...texts, [person.userId]: event.target.value }))}
            />
          ))}
          <p className={styles.remaining} aria-live="polite">
            {remaining !== null && remaining > 0 && t("form.split.left", { amount: money(remaining) })}
            {remaining !== null && remaining < 0 && t("form.split.over", { amount: money(-remaining) })}
          </p>
          {errors.split && <SplitError code={errors.split} />}
        </fieldset>
      )}

      <div className={styles.actions}>
        <ActionLink to={existing ? `/expenses/${existing.id}` : "/expenses"} variant="ghost">
          {t("form.cancel")}
        </ActionLink>
        <Button
          type="submit"
          loading={save.isPending}
          loadingLabel={t("form.saving")}
          disabled={method === "EXACT" && remaining !== 0}
        >
          {t("form.save")}
        </Button>
      </div>
    </form>
  );
}

function SplitError({ code }: { code: ErrorCode }) {
  const { t } = useTranslation("errors");
  return (
    <p className={styles.splitError}>
      <CircleAlert aria-hidden="true" className={styles.splitErrorIcon} />
      {t(code)}
    </p>
  );
}
