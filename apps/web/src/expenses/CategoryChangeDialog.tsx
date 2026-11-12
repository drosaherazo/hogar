import { Alert, Button, ChoiceGroup, Dialog } from "@hogar/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMoney } from "../i18n/format";
import styles from "./CategoryChangeDialog.module.css";

export type CategoryChangeChoice = "apply" | "keep";

export interface CategoryChangeRow {
  userId: string;
  name: string;
  beforeCents: number;
  afterCents: number;
}

export interface CategoryChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The category the expense moves to; `null` when it's left without one. */
  target: { name: string; ownSplit: boolean } | null;
  /** Each person's share now and with the new split, in member order. */
  rows: readonly CategoryChangeRow[];
  /** False when nobody pays in the new category's split: only "keep" is offered. */
  canApply: boolean;
  /** A translated error to show above the choice (the split changed meanwhile). */
  error?: string | undefined;
  saving: boolean;
  onConfirm: (choice: CategoryChangeChoice) => void;
}

/**
 * Moving an expense saved with the default split to another category is the only edit where a
 * label can move money (spec Story 4). Before saving, this shows each person's share before and
 * after, in words and numbers, and lets the person apply the new split (preselected) or keep the
 * current shares.
 */
export function CategoryChangeDialog({
  open,
  onOpenChange,
  target,
  rows,
  canApply,
  error,
  saving,
  onConfirm,
}: CategoryChangeDialogProps) {
  const { t } = useTranslation("expenses");
  const money = useMoney();
  const listId = useId();
  const [choice, setChoice] = useState<CategoryChangeChoice>(canApply ? "apply" : "keep");
  const selected = canApply ? choice : "keep";
  const applyLabel = target?.ownSplit
    ? t("categoryChange.apply", { name: target.name })
    : t("categoryChange.applyHousehold");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("categoryChange.title")}
      closeLabel={t("categoryChange.close")}
      actions={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("categoryChange.cancel")}
          </Button>
          <Button loading={saving} loadingLabel={t("form.saving")} onClick={() => onConfirm(selected)}>
            {t("categoryChange.confirm")}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {error && <Alert tone="danger">{error}</Alert>}
        <p id={listId} className={styles.intro}>
          {target ? t("categoryChange.intro", { name: target.name }) : t("categoryChange.introNone")}
        </p>
        <ul className={styles.rows} aria-labelledby={listId}>
          {rows.map((row) => (
            <li key={row.userId} className={styles.row}>
              {t("categoryChange.row", {
                name: row.name,
                before: money(row.beforeCents),
                after: money(row.afterCents),
              })}
            </li>
          ))}
        </ul>
        {!canApply && target && <p className={styles.note}>{t("categoryChange.noDefault", { name: target.name })}</p>}
        <ChoiceGroup
          legend={t("categoryChange.legend")}
          name="category-change"
          value={selected}
          onChange={(value) => setChoice(value === "keep" ? "keep" : "apply")}
          options={[
            ...(canApply ? [{ value: "apply", label: applyLabel }] : []),
            { value: "keep", label: t("categoryChange.keep") },
          ]}
        />
      </div>
    </Dialog>
  );
}
