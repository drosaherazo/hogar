import type { ActivityItem } from "@hogar/shared";
import { Amount, Button } from "@hogar/ui";
import clsx from "clsx";
import { HandCoins, ReceiptText } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDates, useMoney } from "../i18n/format";
import styles from "./ActivityList.module.css";

export interface ActivityListProps {
  items: readonly ActivityItem[];
  /** The signed-in person, so rows can say "You paid". */
  viewerId: string;
  hasMore: boolean;
  loadingMore: boolean;
  onShowMore: () => void;
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
export function ActivityList({ items, viewerId, hasMore, loadingMore, onShowMore }: ActivityListProps) {
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
                  {item.kind === "expense" ? (
                    <ExpenseRow item={item} viewerId={viewerId} />
                  ) : (
                    <SettlementRow item={item} />
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

function ExpenseRow({ item, viewerId }: { item: Extract<ActivityItem, { kind: "expense" }>; viewerId: string }) {
  const { t } = useTranslation("expenses");
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
        <span className={styles.meta}>
          <span>
            {item.paidBy.userId === viewerId ? t("history.youPaid") : t("history.paid", { name: item.paidBy.name })}
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

function SettlementRow({ item }: { item: Extract<ActivityItem, { kind: "settlement" }> }) {
  const { t } = useTranslation("expenses");
  const dates = useDates();
  return (
    <div className={styles.row}>
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
    </div>
  );
}
