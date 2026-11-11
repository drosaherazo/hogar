import { canEditContent } from "@hogar/shared";
import { Card, EmptyState, Spinner } from "@hogar/ui";
import { Plus, ReceiptText, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { useCurrentUser } from "../../auth/guards";
import { ActivityList } from "../../expenses/ActivityList";
import { BalanceSentence } from "../../expenses/BalanceSentence";
import { useActivity, useBalances } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./ExpensesPage.module.css";

/** The household's expenses and payments, and the way to add one. */
export function ExpensesPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const household = useHousehold();

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;

  return (
    <AppShell>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t("title")}</h1>
        {current && canEditContent(current.myRole) && (
          <ActionLink to="/expenses/new" variant="primary" icon={<Plus />}>
            {t("add")}
          </ActionLink>
        )}
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && (
          <>
            <Summary />
            <History />
          </>
        )
      )}
    </AppShell>
  );
}

/** The viewer's balance in one sentence, and the way to everyone's. */
function Summary() {
  const { t } = useTranslation("expenses");
  const balances = useBalances();
  return (
    <div className={styles.summary}>
      {balances.isSuccess && <BalanceSentence cents={balances.data.myBalanceCents} className={styles.balance} />}
      <ActionLink to="/balances" variant="ghost" icon={<Scale />}>
        {t("balances.link")}
      </ActionLink>
    </div>
  );
}

function History() {
  const { t } = useTranslation(["expenses", "common"]);
  const user = useCurrentUser();
  const activity = useActivity();

  if (activity.isPending) return <Spinner label={t("common:loading")} />;
  if (activity.isError) {
    return <LoadError title={t("loadError")} error={activity.error} onRetry={() => void activity.refetch()} />;
  }

  const items = activity.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState icon={<ReceiptText />} title={t("empty.title")} description={t("empty.description")} />
      </Card>
    );
  }
  return (
    <ActivityList
      items={items}
      viewerId={user.id}
      hasMore={activity.hasNextPage}
      loadingMore={activity.isFetchingNextPage}
      onShowMore={() => void activity.fetchNextPage()}
    />
  );
}
