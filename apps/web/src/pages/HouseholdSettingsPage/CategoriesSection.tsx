import { MAX_CATEGORIES, type CategoryView, type HouseholdView } from "@hogar/shared";
import { Badge, Button, Card, EmptyState, Spinner } from "@hogar/ui";
import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { CategoryLabel } from "../../expenses/CategoryLabel";
import { useCategories } from "../../expenses/useCategories";
import { LoadError } from "../../household/LoadError";
import { useList, usePercent } from "../../i18n/format";
import { CategoryDialog } from "./CategoryDialog";
import styles from "./HouseholdSettingsPage.module.css";

/**
 * The household's expense categories and how each one is split. Everyone sees them; only admins
 * add, edit and delete them (FR-003, FR-004).
 */
export function CategoriesSection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "common"]);
  const categories = useCategories();
  const heading = useRef<HTMLHeadingElement>(null);
  const { hash } = useLocation();
  const isAdmin = household.myRole === "ADMIN";
  const [editing, setEditing] = useState<CategoryView | "new" | null>(null);
  const [done, setDone] = useState<"saved" | "deleted" | null>(null);

  // The expense form links to #categories when nobody pays in a category's split.
  useEffect(() => {
    if (hash === "#categories") {
      heading.current?.scrollIntoView?.({ block: "start" });
      heading.current?.focus();
    }
  }, [hash]);

  const list = categories.data ?? [];
  const atLimit = list.length >= MAX_CATEGORIES;

  return (
    <Card as="section" padding="lg" aria-labelledby="categories" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="categories" ref={heading} tabIndex={-1} className={styles.sectionTitle}>
          {t("settings.categories.title")}
        </h2>
        {isAdmin && list.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus />}
            disabled={atLimit}
            onClick={() => {
              setDone(null);
              setEditing("new");
            }}
          >
            {t("settings.categories.add")}
          </Button>
        )}
      </div>
      <p className={styles.muted}>{t("settings.categories.description")}</p>
      {isAdmin && atLimit && <p className={styles.muted}>{t("settings.categories.limit")}</p>}

      {categories.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : categories.isError ? (
        <LoadError error={categories.error} onRetry={() => void categories.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={isAdmin ? t("settings.categories.empty") : t("settings.categories.emptyReadOnly")}
          actions={
            isAdmin && (
              <Button icon={<Plus />} onClick={() => setEditing("new")}>
                {t("settings.categories.add")}
              </Button>
            )
          }
        />
      ) : (
        <ul className={styles.list}>
          {list.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              household={household}
              isAdmin={isAdmin}
              onEdit={() => {
                setDone(null);
                setEditing(category);
              }}
            />
          ))}
        </ul>
      )}

      {!isAdmin && <p className={styles.muted}>{t("settings.categories.readOnly")}</p>}
      {done && (
        <p className={styles.saved} role="status">
          <Check aria-hidden="true" size="1em" />{" "}
          {done === "saved" ? t("settings.categories.dialog.saved") : t("settings.categories.delete.deleted")}
        </p>
      )}

      {editing && (
        <CategoryDialog
          household={household}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setDone(message);
          }}
        />
      )}
    </Card>
  );
}

function CategoryRow({
  category,
  household,
  isAdmin,
  onEdit,
}: {
  category: CategoryView;
  household: HouseholdView;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation("household");
  const percent = usePercent();
  const list = useList();
  const names = new Map(household.members.map((member) => [member.id, member.name]));
  const summary = category.weights
    ? t("settings.categories.ownSplit", {
        shares: list(
          category.weights.map((entry) => `${names.get(entry.membershipId) ?? ""} ${percent(entry.shareBps)}`),
        ),
      })
    : t("settings.categories.followsHousehold");

  return (
    <li className={styles.listItem}>
      <span className={styles.itemText}>
        <span className={styles.itemTitle}>
          <CategoryLabel category={category} />
          {isAdmin && category.needsReview && <Badge tone="warning">{t("settings.categories.needsReview")}</Badge>}
        </span>
        <span className={styles.itemMeta}>{summary}</span>
      </span>
      {isAdmin && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("settings.categories.edit", { name: category.name })}
        </Button>
      )}
    </li>
  );
}
