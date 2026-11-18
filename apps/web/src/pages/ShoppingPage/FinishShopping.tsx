import { Button, Dialog } from "@hogar/ui";
import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { OFFLINE_REASON_ID } from "../../offline/OfflineBanner";
import { useReadOnly } from "../../offline/useOnline";
import styles from "./FinishShopping.module.css";

/** The page's room below its content follows the bar's real height, so it never covers the last item. */
const BAR_SIZE = "--cart-bar-size";

/**
 * "2 in your cart · Finish shopping", fixed above the tab bar while the viewer's cart has items,
 * so finishing is always one tap away however long the list is. Its text wraps with large text or
 * a long language, and the page keeps exactly the room it takes.
 */
export function CartBar({ count, onFinish }: { count: number; onFinish: () => void }) {
  const { t } = useTranslation("shopping");
  const bar = useRef<HTMLDivElement>(null);
  const countId = useId();

  useLayoutEffect(() => {
    const element = bar.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty(BAR_SIZE, `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(BAR_SIZE);
    };
  }, []);

  return (
    <div ref={bar} className={styles.bar}>
      <p id={countId} className={styles.count}>
        {t("cartBar.count", { count })}
      </p>
      <Button aria-describedby={countId} onClick={onFinish}>
        {t("cartBar.finish")}
      </Button>
    </div>
  );
}

export interface FinishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How many things are in the viewer's cart now; the dialog follows it live. */
  count: number;
  /** Opens the expense form for the cart; saving it finishes shopping. */
  onRecord: () => void;
  onFinishWithoutExpense: () => void;
}

/**
 * Says what finishing does before anything changes: what is in the cart leaves the list, what
 * wasn't found stays. Noting what was paid is the main choice, since most shopping is shared;
 * finishing without an expense is there for the rest. Each choice says when to pick it. Cancel
 * comes first and has focus, so a reflex Enter changes nothing. The dialog sits outside the page,
 * so offline its choices are switched off here, with the reason.
 */
export function FinishDialog({ open, onOpenChange, count, onRecord, onFinishWithoutExpense }: FinishDialogProps) {
  const { t } = useTranslation("shopping");
  const readOnly = useReadOnly();
  const recordHintId = useId();
  const hintId = useId();
  const describedBy = (id: string) => (readOnly ? `${id} ${OFFLINE_REASON_ID}` : id);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("finish.title")}
      description={t("finish.description", { count })}
      closeLabel={t("close")}
      actions={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
      }
    >
      <div className={styles.choice}>
        <Button fullWidth disabled={readOnly} aria-describedby={describedBy(recordHintId)} onClick={onRecord}>
          {t("finish.record")}
        </Button>
        <p id={recordHintId} className={styles.hint}>
          {t("finish.recordHint")}
        </p>
      </div>
      <div className={styles.choice}>
        <Button
          fullWidth
          variant="secondary"
          disabled={readOnly}
          aria-describedby={describedBy(hintId)}
          onClick={onFinishWithoutExpense}
        >
          {t("finish.withoutExpense")}
        </Button>
        <p id={hintId} className={styles.hint}>
          {t("finish.withoutExpenseHint")}
        </p>
      </div>
    </Dialog>
  );
}
