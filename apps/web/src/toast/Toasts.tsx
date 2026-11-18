import { ToastQueue, ToastRegion } from "@hogar/ui";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OFFLINE_REASON_ID } from "../offline/OfflineBanner";
import { useReadOnly } from "../offline/useOnline";
import styles from "./Toasts.module.css";

const ToastQueueContext = createContext<ToastQueue | null>(null);

/**
 * One queue for the whole app, so a toast such as "You deleted Milk · Undo" stays when the
 * person moves to another page, like the change it reports.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(() => new ToastQueue());
  return <ToastQueueContext.Provider value={queue}>{children}</ToastQueueContext.Provider>;
}

/** Where to send a toast: `useToasts().show({ message, action })`. */
export function useToasts(): ToastQueue {
  const queue = useContext(ToastQueueContext);
  if (!queue) throw new Error("useToasts needs a ToastProvider");
  return queue;
}

/**
 * Where toasts show: at the bottom, above the tab bar. The region sits outside the page, so the
 * offline fieldset doesn't reach it: offline, its action is switched off here, with the reason
 * the banner gives (ADR 0015).
 */
export function Toasts() {
  const { t } = useTranslation();
  const queue = useToasts();
  const readOnly = useReadOnly();
  return (
    <ToastRegion
      queue={queue}
      label={t("toasts.label")}
      closeLabel={t("toasts.close")}
      actionDisabled={readOnly}
      actionDescribedBy={readOnly ? OFFLINE_REASON_ID : undefined}
      className={styles.region}
    />
  );
}
