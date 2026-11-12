import { canEditContent, type CategoryView, type HouseholdView, type SettlementView } from "@hogar/shared";
import { Button, Card, EmptyState, Select, Spinner } from "@hogar/ui";
import { Check, Plus, ReceiptText, Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useSearchParams } from "react-router";
import { useCurrentUser } from "../../auth/guards";
import { ActivityList } from "../../expenses/ActivityList";
import { BalanceSentence } from "../../expenses/BalanceSentence";
import { categoryText } from "../../expenses/CategoryLabel";
import { PaymentDetailsDialog, RecordPaymentDialog } from "../../expenses/PaymentDialog";
import { useCategories } from "../../expenses/useCategories";
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
  const location = useLocation();
  const deleted = (location.state as { deleted?: boolean } | null)?.deleted === true;

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
      {deleted && (
        <p role="status" className={styles.done}>
          <Check aria-hidden="true" className={styles.doneIcon} />
          {t("delete.done")}
        </p>
      )}
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && (
          <>
            <Summary />
            <History household={current} />
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

/** "All expenses" (no value), one category's id, or `none`. Lives in the URL (`?category=`). */
function useCategoryFilter() {
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const value = params.get("category") ?? "";
  const category = categories.data?.find((entry) => entry.id === value) ?? null;

  const setValue = (next: string) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "") updated.delete("category");
        else updated.set("category", next);
        return updated;
      },
      { replace: false },
    );

  // A category deleted since the link was made: show everything rather than an unnamed filter.
  const unknown = value !== "" && value !== "none" && categories.isSuccess && category === null;
  useEffect(() => {
    if (unknown) setValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `setValue` is rebuilt every render; `unknown` is the trigger.
  }, [unknown]);

  return { value: unknown ? "" : value, category, categories: categories.data ?? [], setValue };
}

/** Filters the history by one category or by "No category" (FR-026). Balances never change. */
function CategoryFilter({
  value,
  category,
  categories,
  onChange,
}: {
  value: string;
  category: CategoryView | null;
  categories: readonly CategoryView[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("expenses");
  return (
    <div className={styles.filter}>
      <Select
        label={t("filter.label")}
        className={styles.filterSelect}
        options={[
          { value: "", label: t("filter.all") },
          ...categories.map((entry) => ({ value: entry.id, label: categoryText(entry) })),
          { value: "none", label: t("filter.none") },
        ]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== "" && (
        <div className={styles.showing}>
          <p className={styles.showingText} aria-live="polite">
            {value === "none" ? t("filter.showingNone") : t("filter.showing", { name: category?.name ?? "" })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => onChange("")}>
            {t("filter.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

function History({ household }: { household: HouseholdView }) {
  const filter = useCategoryFilter();
  return (
    <>
      <CategoryFilter
        value={filter.value}
        category={filter.category}
        categories={filter.categories}
        onChange={filter.setValue}
      />
      <HistoryList household={household} filter={filter.value} filterName={filter.category?.name ?? null} />
    </>
  );
}

function HistoryList({
  household,
  filter,
  filterName,
}: {
  household: HouseholdView;
  filter: string;
  filterName: string | null;
}) {
  const { t } = useTranslation(["expenses", "common"]);
  const user = useCurrentUser();
  const activity = useActivity(filter === "" ? undefined : filter);
  const balances = useBalances();
  const [openSettlement, setOpenSettlement] = useState<string | null>(null);
  // Editing a payment opens the payment form; a new key per edit so it starts from that payment.
  const nextKey = useRef(0);
  const [editing, setEditing] = useState<{ key: number; settlement: SettlementView } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function editPayment(settlement: SettlementView) {
    setOpenSettlement(null);
    nextKey.current += 1;
    setEditing({ key: nextKey.current, settlement });
    setEditOpen(true);
  }

  if (activity.isPending) return <Spinner label={t("common:loading")} />;
  if (activity.isError) {
    return <LoadError title={t("loadError")} error={activity.error} onRetry={() => void activity.refetch()} />;
  }

  const items = activity.data.pages.flatMap((page) => page.items);
  if (items.length === 0 && filter !== "") {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<ReceiptText />}
          title={filter === "none" ? t("filter.emptyNone") : t("filter.empty", { name: filterName ?? "" })}
        />
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState icon={<ReceiptText />} title={t("empty.title")} description={t("empty.description")} />
      </Card>
    );
  }
  return (
    <>
      <ActivityList
        items={items}
        viewerId={user.id}
        hasMore={activity.hasNextPage}
        loadingMore={activity.isFetchingNextPage}
        onShowMore={() => void activity.fetchNextPage()}
        onOpenSettlement={setOpenSettlement}
      />
      <PaymentDetailsDialog
        settlementId={openSettlement}
        onClose={() => setOpenSettlement(null)}
        household={household}
        onEdit={editPayment}
      />
      {editing && balances.data && (
        <RecordPaymentDialog
          key={editing.key}
          open={editOpen}
          onOpenChange={setEditOpen}
          household={household}
          balances={balances.data}
          editing={editing.settlement}
          onRecorded={() => undefined}
        />
      )}
    </>
  );
}
