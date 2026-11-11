import {
  settlementInputSchema,
  suggestSettlements,
  type BalancesView,
  type ErrorCode,
  type HouseholdView,
  type PersonRef,
} from "@hogar/shared";
import { Alert, Avatar, Button, Dialog, Select, Spinner, TextField, useLocale } from "@hogar/ui";
import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";
import { useCurrentUser } from "../auth/guards";
import { localToday, useDates, useMoney } from "../i18n/format";
import { amountInputValue, parseAmount } from "./money";
import styles from "./PaymentDialog.module.css";
import { avatarPropsFor } from "./people";
import { useCreateSettlement, useSettlement } from "./useExpenses";

type Field = "from" | "to" | "amount" | "date";
type FieldErrors = Partial<Record<Field, ErrorCode>>;
const FIELD_OF: Record<string, Field> = { fromUserId: "from", toUserId: "to", amountCents: "amount", date: "date" };

export interface PaymentDraft {
  fromUserId: string;
  toUserId: string;
  amountCents?: number | undefined;
}

/**
 * People a payment can be between: current members, and former members who still owe or are
 * owed something (so remaining members can settle up with them).
 */
function paymentPeople(household: HouseholdView, balances: BalancesView): PersonRef[] {
  const current = household.members.map((member) => ({
    userId: member.userId,
    name: member.name,
    avatarUrl: member.avatarUrl,
    former: false,
  }));
  const former = balances.balances
    .filter((entry) => entry.person.former && entry.balanceCents !== 0)
    .map((entry) => entry.person);
  return [...current, ...former];
}

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: HouseholdView;
  balances: BalancesView;
  /** Prefilled values, such as a suggested payment. */
  initial?: PaymentDraft | undefined;
  onRecorded: () => void;
}

/**
 * Writing down money that changed hands outside the app. It shows what is owed between the two
 * people right now and, when the amount is bigger, that the balance will reverse.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  household,
  balances,
  initial,
  onRecorded,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation(["expenses", "errors"]);
  const user = useCurrentUser();
  const locale = useLocale();
  const money = useMoney();
  const create = useCreateSettlement();
  const formId = useId();
  const firstField = useRef<HTMLSelectElement>(null);

  const people = paymentPeople(household, balances);
  const nameOf = (userId: string) => people.find((person) => person.userId === userId)?.name ?? "";
  const firstOther = people.find((person) => person.userId !== user.id)?.userId ?? "";

  const [fromUserId, setFromUserId] = useState(initial?.fromUserId ?? user.id);
  const [toUserId, setToUserId] = useState(initial?.toUserId ?? firstOther);
  const [amountText, setAmountText] = useState(
    initial?.amountCents === undefined ? "" : amountInputValue(initial.amountCents, locale),
  );
  const [date, setDate] = useState(localToday);
  const [errors, setErrors] = useState<FieldErrors>({});

  const owedNow =
    balances.suggestions.find((entry) => entry.from.userId === fromUserId && entry.to.userId === toUserId)
      ?.amountCents ?? 0;
  const cents = parseAmount(amountText);
  const reversed =
    cents !== null && cents > 0 && fromUserId !== toUserId
      ? suggestSettlements(
          balances.balances.map((entry) => ({
            userId: entry.person.userId,
            balanceCents:
              entry.balanceCents +
              (entry.person.userId === fromUserId ? cents : 0) -
              (entry.person.userId === toUserId ? cents : 0),
          })),
        ).find((entry) => entry.fromUserId === toUserId && entry.toUserId === fromUserId)
      : undefined;

  const error = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };
  const options = people.map((person) => ({ value: person.userId, label: person.name }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = settlementInputSchema.safeParse({
      fromUserId,
      toUserId,
      amountCents: parseAmount(amountText) ?? Number.NaN,
      date,
    });
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = FIELD_OF[String(issue.path[0])];
        if (field && !next[field]) next[field] = issue.message as ErrorCode;
      }
      // The schema only compares the two people once every field is valid; say it now too.
      if (fromUserId === toUserId && !next.to) next.to = "settlement.same_person";
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(result.data, {
      onSuccess: () => {
        onOpenChange(false);
        onRecorded();
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("payment.recordTitle")}
      description={t("payment.description")}
      closeLabel={t("payment.close")}
      initialFocus={firstField}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("payment.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending} loadingLabel={t("payment.saving")}>
            {t("payment.save")}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        {create.isError && <Alert tone="danger">{t(errorKey(create.error))}</Alert>}
        <Select
          ref={firstField}
          label={t("payment.from")}
          options={options}
          value={fromUserId}
          onChange={(event) => setFromUserId(event.target.value)}
          error={error("from")}
        />
        <Select
          label={t("payment.to")}
          options={options}
          value={toUserId}
          onChange={(event) => setToUserId(event.target.value)}
          error={error("to")}
        />
        <TextField
          label={t("payment.amount")}
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          error={error("amount")}
        />
        <TextField
          type="date"
          label={t("payment.date")}
          value={date}
          max={localToday()}
          onChange={(event) => setDate(event.target.value)}
          error={error("date")}
        />
        {owedNow > 0 && (
          <p className={styles.note}>
            {t("payment.owedNow", { from: nameOf(fromUserId), to: nameOf(toUserId), amount: money(owedNow) })}
          </p>
        )}
        {reversed && (
          <p className={styles.note}>
            {t("payment.reverses", {
              from: nameOf(fromUserId),
              to: nameOf(toUserId),
              amount: money(reversed.amountCents),
            })}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export interface PaymentDetailsDialogProps {
  /** The payment to show; `null` closes the dialog. */
  settlementId: string | null;
  onClose: () => void;
  household: HouseholdView;
}

/** A payment from the history: who paid whom, how much, when, and who wrote it down. */
export function PaymentDetailsDialog({ settlementId, onClose, household }: PaymentDetailsDialogProps) {
  const { t } = useTranslation(["expenses", "errors", "common"]);
  const settlement = useSettlement(settlementId);
  const money = useMoney();
  const dates = useDates();

  return (
    <Dialog
      open={settlementId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("payment.detailsTitle")}
      closeLabel={t("payment.close")}
      actions={
        <Button variant="secondary" onClick={onClose}>
          {t("payment.close")}
        </Button>
      }
    >
      {settlement.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : settlement.isError ? (
        <Alert tone="danger">{t(errorKey(settlement.error))}</Alert>
      ) : (
        <div className={styles.details}>
          <p className={styles.people}>
            <Avatar size="sm" decorative {...avatarPropsFor(settlement.data.from, household.members)} />
            <span>{t("payment.paid", { from: settlement.data.from.name, to: settlement.data.to.name })}</span>
          </p>
          <p className={styles.amount}>{money(settlement.data.amountCents)}</p>
          <p className={styles.meta}>{dates.medium(settlement.data.date)}</p>
          <p className={styles.meta}>
            {t("payment.recordedBy", {
              name: settlement.data.createdBy.name,
              date: dates.instant(settlement.data.createdAt),
            })}
          </p>
        </div>
      )}
    </Dialog>
  );
}
