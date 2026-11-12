import type { ActivityItem } from "@hogar/shared";
import { Amount, Button } from "@hogar/ui";
import clsx from "clsx";
import { HandCoins, ReceiptText, Trash2 } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDates, useMoney } from "../i18n/format";
import styles from "./ActivityList.module.css";
import { CategoryLabel } from "./CategoryLabel";
import { usePersonLabel } from "./people";

export interface ActivityListProps {
  items: readonly ActivityItem[];
  /** The signed-in person, so rows can say "You paid". */
  viewerId: string;
  hasMore: boolean;
  loadingMore: boolean;
  onShowMore: () => void;
  /** Payments open in a dialog rather than a page. */
  onOpenSettlement: (id: string) => void;
}

/** Groups items (already newest first) by calendar month, keeping their order. */
function byMonth(items: readonly ActivityItem[]) {
  const groups: { month: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const month = item.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

/** The household's history: expenses and payments by month, newest first. */
export function ActivityList({
  items,
  viewerId,
  hasMore,
  loadingMore,
  onShowMore,
  onOpenSettlement,
}: ActivityListProps) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  const baseId = useId();

  return (
    <div className={styles.history}>
      {byMonth(items).map((group) => {
        const headingId = `${baseId}-${group.month}`;
        return (
          <section key={group.month} aria-labelledby={headingId} className={styles.month}>
            <h2 id={headingId} className={styles.monthTitle}>
              {dates.month(`${group.month}-01`)}
            </h2>
            <ul className={styles.items}>
              {group.items.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  {item.deleted ? (
                    <DeletedRow item={item} deletedBy={item.deleted.by.name} />
                  ) : item.kind === "expense" ? (
                    <ExpenseRow item={item} viewerId={viewerId} />
                  ) : (
                    <SettlementRow item={item} onOpen={() => onOpenSettlement(item.id)} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {hasMore && (
        <Button variant="secondary" onClick={onShowMore} loading={loadingMore} loadingLabel={t("history.loadingMore")}>
          {t("history.showMore")}
        </Button>
      )}
    </div>
  );
}

/**
 * A deleted record stays where it was, as a muted line saying who deleted what. It can't be
 * opened or edited: deleting is visible, never silent (research R17).
 */
function DeletedRow({ item, deletedBy }: { item: ActivityItem; deletedBy: string }) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  const money = useMoney();
  const amount = money(item.amountCents);
  const text =
    item.kind === "expense"
      ? t("history.deletedExpense", { name: deletedBy, description: item.description, amount })
      : t("history.deletedPayment", { name: deletedBy, from: item.from.name, to: item.to.name, amount });

  return (
    <div className={clsx(styles.row, styles.deleted)}>
      <span className={styles.icon} aria-hidden="true">
        <Trash2 />
      </span>
      <span className={styles.main}>
        <span>{text}</span>
        <span className={styles.meta}>
          <span className={styles.date}>{dates.short(item.date)}</span>
        </span>
      </span>
    </div>
  );
}

function ExpenseRow({ item, viewerId }: { item: Extract<ActivityItem, { kind: "expense" }>; viewerId: string }) {
  const { t } = useTranslation("expenses");
  const personLabel = usePersonLabel();
  const dates = useDates();
  const money = useMoney();
  const { kind, amountCents } = item.viewerPart;
  const part =
    kind === "owes"
      ? t("part.owes", { amount: money(amountCents) })
      : kind === "lent"
        ? t("part.lent", { amount: money(amountCents) })
        : t("part.none");

  return (
    <Link to={`/expenses/${item.id}`} className={clsx(styles.row, styles.link)}>
      <span className={styles.icon} aria-hidden="true">
        <ReceiptText />
      </span>
      <span className={styles.main}>
        <span className={styles.title}>{item.description}</span>
        <CategoryLabel category={item.category} className={styles.category} />
        <span className={styles.meta}>
          <span>
            {item.paidBy.userId === viewerId
              ? t("history.youPaid")
              : t("history.paid", { name: personLabel(item.paidBy) })}
          </span>
          <span className={styles.date}>{dates.short(item.date)}</span>
        </span>
      </span>
      <span className={styles.side}>
        <Amount cents={item.amountCents} className={styles.amount} />
        <span className={clsx(styles.part, styles[kind])}>{part}</span>
      </span>
    </Link>
  );
}

function SettlementRow({ item, onOpen }: { item: Extract<ActivityItem, { kind: "settlement" }>; onOpen: () => void }) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  return (
    <button type="button" className={clsx(styles.row, styles.link, styles.button)} onClick={onOpen}>
      <span className={styles.icon} aria-hidden="true">
        <HandCoins />
      </span>
      <span className={styles.main}>
        <span className={styles.title}>{t("history.payment", { from: item.from.name, to: item.to.name })}</span>
        <span className={styles.meta}>
          <span className={styles.date}>{dates.short(item.date)}</span>
        </span>
      </span>
      <span className={styles.side}>
        <Amount cents={item.amountCents} className={styles.amount} />
      </span>
    </button>
  );
}
