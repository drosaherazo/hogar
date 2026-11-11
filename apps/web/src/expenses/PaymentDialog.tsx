import {
  canEditContent,
  settlementInputSchema,
  suggestSettlements,
  type BalancesView,
  type ErrorCode,
  type HouseholdView,
  type PersonRef,
  type SettlementView,
} from "@hogar/shared";
import { Alert, Avatar, Button, Dialog, Select, Spinner, TextField, useLocale } from "@hogar/ui";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";
import { useCurrentUser } from "../auth/guards";
import { localToday, useDates, useMoney } from "../i18n/format";
import { amountInputValue, parseAmount } from "./money";
import styles from "./PaymentDialog.module.css";
import { avatarPropsFor, usePersonLabel } from "./people";
import { useCreateSettlement, useDeleteSettlement, useSettlement, useUpdateSettlement } from "./useExpenses";

type Field = "from" | "to" | "amount" | "date";
type FieldErrors = Partial<Record<Field, ErrorCode>>;
const FIELD_OF: Record<string, Field> = { fromUserId: "from", toUserId: "to", amountCents: "amount", date: "date" };

export interface PaymentDraft {
  fromUserId: string;
  toUserId: string;
  amountCents?: number | undefined;
}

/**
 * People a payment can be between: current members, former members who still owe or are owed
 * something (so remaining members can settle up with them) and, when editing, the payment's own
 * people.
 */
function paymentPeople(household: HouseholdView, balances: BalancesView, editing?: SettlementView): PersonRef[] {
  const people: PersonRef[] = household.members.map((member) => ({
    userId: member.userId,
    name: member.name,
    avatarUrl: member.avatarUrl,
    former: false,
  }));
  const extra = [
    ...balances.balances
      .filter((entry) => entry.person.former && entry.balanceCents !== 0)
      .map((entry) => entry.person),
    ...(editing ? [editing.from, editing.to] : []),
  ];
  for (const person of extra) {
    if (!people.some((known) => known.userId === person.userId)) people.push(person);
  }
  return people;
}

/**
 * Everyone's balance without the payment being edited, so "what's owed now" and the reversal
 * note describe the situation the edited payment will land in, not one where it counts twice.
 */
function balancesWithout(balances: BalancesView, people: readonly PersonRef[], editing?: SettlementView) {
  return people.map((person) => {
    const balanceCents = balances.balances.find((entry) => entry.person.userId === person.userId)?.balanceCents ?? 0;
    if (!editing) return { userId: person.userId, balanceCents };
    const undo =
      (person.userId === editing.from.userId ? -editing.amountCents : 0) +
      (person.userId === editing.to.userId ? editing.amountCents : 0);
    return { userId: person.userId, balanceCents: balanceCents + undo };
  });
}

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: HouseholdView;
  balances: BalancesView;
  /** Prefilled values, such as a suggested payment. */
  initial?: PaymentDraft | undefined;
  /** The payment being edited, if any; it's saved from its own version. */
  editing?: SettlementView | undefined;
  onRecorded: () => void;
}

/**
 * Writing down (or correcting) money that changed hands outside the app. It shows what is owed
 * between the two people right now and, when the amount is bigger, that the balance will reverse.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  household,
  balances,
  initial,
  editing,
  onRecorded,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation(["expenses", "errors"]);
  const user = useCurrentUser();
  const locale = useLocale();
  const money = useMoney();
  const create = useCreateSettlement();
  const update = useUpdateSettlement();
  const save = editing ? update : create;
  const formId = useId();
  const firstField = useRef<HTMLSelectElement>(null);

  const personLabel = usePersonLabel();
  const people = paymentPeople(household, balances, editing);
  const nameOf = (userId: string) => people.find((person) => person.userId === userId)?.name ?? "";
  const firstOther = people.find((person) => person.userId !== user.id)?.userId ?? "";
  const start = editing
    ? { fromUserId: editing.from.userId, toUserId: editing.to.userId, amountCents: editing.amountCents }
    : initial;

  const [fromUserId, setFromUserId] = useState(start?.fromUserId ?? user.id);
  const [toUserId, setToUserId] = useState(start?.toUserId ?? firstOther);
  const [amountText, setAmountText] = useState(
    start?.amountCents === undefined ? "" : amountInputValue(start.amountCents, locale),
  );
  const [date, setDate] = useState(editing?.date ?? localToday());
  const [errors, setErrors] = useState<FieldErrors>({});

  const base = balancesWithout(balances, people, editing);
  const owedNow =
    suggestSettlements(base).find((entry) => entry.fromUserId === fromUserId && entry.toUserId === toUserId)
      ?.amountCents ?? 0;
  const cents = parseAmount(amountText);
  // Right after a former member's last debt is settled, the refetched balances drop them while
  // they're still selected here; previewing a payment to or from someone outside `base` would
  // unbalance it, so there's no reversal note until both people are back in the list.
  const bothListed =
    base.some((entry) => entry.userId === fromUserId) && base.some((entry) => entry.userId === toUserId);
  const reversed =
    cents !== null && cents > 0 && fromUserId !== toUserId && bothListed
      ? suggestSettlements(
          base.map((entry) => ({
            userId: entry.userId,
            balanceCents:
              entry.balanceCents + (entry.userId === fromUserId ? cents : 0) - (entry.userId === toUserId ? cents : 0),
          })),
        ).find((entry) => entry.fromUserId === toUserId && entry.toUserId === fromUserId)
      : undefined;

  const error = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };
  const options = people.map((person) => ({ value: person.userId, label: personLabel(person) }));

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
    const done = () => {
      onOpenChange(false);
      onRecorded();
    };
    if (editing) {
      update.mutate({ id: editing.id, input: { ...result.data, version: editing.version } }, { onSuccess: done });
    } else {
      create.mutate(result.data, { onSuccess: done });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t("payment.editTitle") : t("payment.recordTitle")}
      description={t("payment.description")}
      closeLabel={t("payment.close")}
      initialFocus={firstField}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("payment.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={save.isPending}
            loadingLabel={editing ? t("payment.updating") : t("payment.saving")}
          >
            {editing ? t("payment.update") : t("payment.save")}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        {save.isError && <Alert tone="danger">{t(errorKey(save.error))}</Alert>}
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
  /** Opens the payment form on this payment (editors only). */
  onEdit: (settlement: SettlementView) => void;
}

/**
 * A payment from the history: who paid whom, how much, when, and who wrote it down and changed
 * it. Editors can edit it, or delete it after a confirmation that names it.
 */
export function PaymentDetailsDialog({ settlementId, onClose, household, onEdit }: PaymentDetailsDialogProps) {
  const { t } = useTranslation(["expenses", "errors", "common"]);
  const settlement = useSettlement(settlementId);
  const remove = useDeleteSettlement();
  const money = useMoney();
  const dates = useDates();
  const canEdit = canEditContent(household.myRole);
  const [confirming, setConfirming] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);

  // Closing resets the confirmation, so opening the dialog again always starts on the details.
  const close = () => {
    setConfirming(false);
    onClose();
  };
  // The confirmation starts on "Cancel", the safe choice.
  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
  }, [confirming]);

  const data = settlement.data;
  const title =
    confirming && data
      ? t("payment.delete.title", { from: data.from.name, to: data.to.name, amount: money(data.amountCents) })
      : t("payment.detailsTitle");

  return (
    <Dialog
      open={settlementId !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={title}
      {...(confirming ? { description: t("payment.delete.description") } : {})}
      closeLabel={t("payment.close")}
      actions={
        confirming && data ? (
          <>
            <Button ref={cancelButton} variant="secondary" onClick={() => setConfirming(false)}>
              {t("payment.cancel")}
            </Button>
            <Button
              loading={remove.isPending}
              loadingLabel={t("payment.delete.deleting")}
              onClick={() => remove.mutate({ id: data.id, version: data.version }, { onSuccess: close })}
            >
              {t("payment.delete.confirm")}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>
            {t("payment.close")}
          </Button>
        )
      }
    >
      {settlement.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : settlement.isError ? (
        <Alert tone="danger">{t(errorKey(settlement.error))}</Alert>
      ) : confirming ? (
        remove.isError && <Alert tone="danger">{t(errorKey(remove.error))}</Alert>
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
          {settlement.data.editedBy && settlement.data.editedAt && (
            <p className={styles.meta}>
              {t("payment.editedBy", {
                name: settlement.data.editedBy.name,
                date: dates.instant(settlement.data.editedAt),
              })}
            </p>
          )}
          {canEdit && (
            <div className={styles.actions}>
              <Button variant="secondary" size="sm" icon={<Pencil />} onClick={() => onEdit(settlement.data)}>
                {t("payment.edit")}
              </Button>
              <Button variant="secondary" size="sm" icon={<Trash2 />} onClick={() => setConfirming(true)}>
                {t("payment.remove")}
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
