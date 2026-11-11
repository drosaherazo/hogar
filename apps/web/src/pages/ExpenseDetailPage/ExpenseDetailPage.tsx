import type { ExpenseView, MemberView } from "@hogar/shared";
import { Alert, Amount, Avatar, Card, Spinner } from "@hogar/ui";
import { ArrowLeft, Check } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useParams } from "react-router";
import { errorKey } from "../../api/client";
import { avatarPropsFor } from "../../expenses/people";
import { useExpense } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { useDates } from "../../i18n/format";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
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
        current && <ExpenseDetails id={id} members={current.members} />
      )}
    </AppShell>
  );
}

function ExpenseDetails({ id, members }: { id: string; members: MemberView[] }) {
  const { t } = useTranslation(["expenses", "errors", "common"]);
  const expense = useExpense(id);

  if (expense.isPending) return <Spinner label={t("common:loading")} />;
  if (expense.isError) return <Alert tone="danger">{t(errorKey(expense.error))}</Alert>;
  return <Details expense={expense.data} members={members} />;
}

function Details({ expense, members }: { expense: ExpenseView; members: MemberView[] }) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  const titleId = useId();
  const sharesId = useId();
  const { method, shares } = expense.split;

  return (
    <Card as="article" padding="lg" className={styles.card} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h1 id={titleId} className={styles.title}>
          {expense.description}
        </h1>
        <Amount cents={expense.amountCents} className={styles.total} />
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t("details.paidBy")}</dt>
          <dd className={styles.person}>
            <Avatar size="sm" decorative {...avatarPropsFor(expense.paidBy, members)} />
            {expense.paidBy.name}
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
              <span className={styles.shareName}>{share.person.name}</span>
              <Amount cents={share.amountCents} />
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.audit}>
        {t("details.recordedBy", { name: expense.createdBy.name, date: dates.instant(expense.createdAt) })}
      </p>
    </Card>
  );
}
