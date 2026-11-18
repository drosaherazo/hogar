import { canEditContent, type BoughtItemView, type ExpenseView, type MemberView } from "@hogar/shared";
import { Alert, Avatar, Badge, Button, Card, Dialog, Spinner } from "@hogar/ui";
import { ArrowLeft, Check, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { errorKey } from "../../api/client";
import { CategoryLabel } from "../../expenses/CategoryLabel";
import { Money } from "../../expenses/Money";
import { avatarPropsFor } from "../../expenses/people";
import { useDeleteExpense, useExpense } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { useDates, useMoney } from "../../i18n/format";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import { BoughtItems } from "../../shopping/BoughtItems";
import styles from "./ExpenseDetailPage.module.css";

/** One expense: how much, who paid, when, and everyone's share. */
export function ExpenseDetailPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const { id = "" } = useParams();
  const location = useLocation();
  const household = useHousehold();
  const saved = (location.state as { saved?: boolean } | null)?.saved === true;

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;

  return (
    <AppShell>
      <ActionLink to="/expenses" variant="ghost" icon={<ArrowLeft />} className={styles.back}>
        {t("details.back")}
      </ActionLink>
      {saved && (
        <p role="status" className={styles.saved}>
          <Check aria-hidden="true" className={styles.savedIcon} />
          {t("details.saved")}
        </p>
      )}
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && <ExpenseDetails id={id} members={current.members} canEdit={canEditContent(current.myRole)} />
      )}
    </AppShell>
  );
}

function ExpenseDetails({ id, members, canEdit }: { id: string; members: MemberView[]; canEdit: boolean }) {
  const { t } = useTranslation(["expenses", "errors", "common"]);
  const expense = useExpense(id);

  if (expense.isPending) return <Spinner label={t("common:loading")} />;
  if (expense.isError) return <Alert tone="danger">{t(errorKey(expense.error))}</Alert>;
  return <Details expense={expense.data} members={members} canEdit={canEdit} />;
}

/** Deleting asks first, naming exactly what goes, and starts on "Cancel". */
function DeleteExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: ExpenseView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(["expenses", "errors"]);
  const money = useMoney();
  const navigate = useNavigate();
  const remove = useDeleteExpense();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("delete.title", { description: expense.description, amount: money(expense.amountCents) })}
      description={t("delete.description")}
      closeLabel={t("delete.close")}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("delete.cancel")}
          </Button>
          <Button
            loading={remove.isPending}
            loadingLabel={t("delete.deleting")}
            onClick={() =>
              remove.mutate(
                { id: expense.id, version: expense.version },
                { onSuccess: () => void navigate("/expenses", { state: { deleted: true } }) },
              )
            }
          >
            {t("delete.confirm")}
          </Button>
        </>
      }
    >
      {remove.isError && <Alert tone="danger">{t(errorKey(remove.error))}</Alert>}
    </Dialog>
  );
}

/** What was bought; an expense the installed app kept from before purchases existed has nothing. */
function boughtItemsOf(expense: ExpenseView): readonly BoughtItemView[] {
  const kept: { boughtItems?: readonly BoughtItemView[] } = expense;
  return kept.boughtItems ?? [];
}

function Details({ expense, members, canEdit }: { expense: ExpenseView; members: MemberView[]; canEdit: boolean }) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  const titleId = useId();
  const sharesId = useId();
  const boughtId = useId();
  const [deleting, setDeleting] = useState(false);
  const { method, shares } = expense.split;
  const bought = boughtItemsOf(expense);

  return (
    <Card as="article" padding="lg" className={styles.card} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h1 id={titleId} className={styles.title}>
          {expense.description}
        </h1>
        <CategoryLabel category={expense.category} className={styles.category} />
        <Money units={expense.amountCents} className={styles.total} />
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t("details.paidBy")}</dt>
          <dd className={styles.person}>
            <Avatar size="sm" decorative {...avatarPropsFor(expense.paidBy, members)} />
            {expense.paidBy.name}
            {expense.paidBy.former && <Badge>{t("balances.former")}</Badge>}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("details.date")}</dt>
          <dd>{dates.medium(expense.date)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("details.split")}</dt>
          <dd>
            {method === "EQUAL"
              ? t("details.method.EQUAL", { count: shares.length })
              : t(method === "EXACT" ? "details.method.EXACT" : "details.method.WEIGHTS")}
          </dd>
        </div>
      </dl>

      <section className={styles.sharesSection} aria-labelledby={sharesId}>
        <h2 id={sharesId} className={styles.sharesTitle}>
          {t("details.shares")}
        </h2>
        <ul className={styles.shares} aria-labelledby={sharesId}>
          {shares.map((share) => (
            <li key={share.person.userId} className={styles.share}>
              <Avatar size="sm" decorative {...avatarPropsFor(share.person, members)} />
              <span className={styles.shareName}>
                {share.person.name}
                {share.person.former && <Badge>{t("balances.former")}</Badge>}
              </span>
              <Money units={share.amountCents} />
            </li>
          ))}
        </ul>
      </section>

      {bought.length > 0 && (
        <section className={styles.sharesSection} aria-labelledby={boughtId}>
          <h2 id={boughtId} className={styles.sharesTitle}>
            {t("details.bought")}
          </h2>
          <BoughtItems items={bought} labelledBy={boughtId} />
        </section>
      )}

      <div className={styles.auditGroup}>
        <p className={styles.audit}>
          {t("details.recordedBy", { name: expense.createdBy.name, date: dates.instant(expense.createdAt) })}
        </p>
        {expense.editedBy && expense.editedAt && (
          <p className={styles.audit}>
            {t("details.editedBy", { name: expense.editedBy.name, date: dates.instant(expense.editedAt) })}
          </p>
        )}
      </div>

      {canEdit && (
        <div className={styles.actions}>
          <ActionLink to={`/expenses/${expense.id}/edit`} changesData icon={<Pencil />}>
            {t("details.edit")}
          </ActionLink>
          <Button variant="secondary" icon={<Trash2 />} onClick={() => setDeleting(true)}>
            {t("details.remove")}
          </Button>
        </div>
      )}
      <DeleteExpenseDialog expense={expense} open={deleting} onOpenChange={setDeleting} />
    </Card>
  );
}
