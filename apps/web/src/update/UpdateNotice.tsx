import { Alert, Button } from "@hogar/ui";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAppUpdate, type AppUpdate } from "./appUpdate";
import styles from "./UpdateNotice.module.css";

/** Notices already announced: each page has its own shell, so the notice mounts again on every page. */
const announced = new WeakSet<AppUpdate>();

/**
 * The quiet update notice: once a new version has downloaded, it offers to switch now or later.
 * It never reloads by itself, so nothing being typed is lost; left for later, it stays away and
 * the new version takes over the next time Hogar opens.
 */
export function UpdateNotice() {
  const { t } = useTranslation();
  const update = useAppUpdate();
  const subscribe = useCallback((onChange: () => void) => update.onChange(onChange), [update]);
  const visible = useSyncExternalStore(subscribe, () => update.ready && !update.postponed);
  const [updating, setUpdating] = useState(false);
  // The first time it appears it starts empty and fills in a moment later, so screen readers
  // announce it; on the next pages it is simply there.
  const [filled, setFilled] = useState(() => announced.has(update));
  useEffect(() => {
    if (!visible || filled) return;
    const timer = setTimeout(() => {
      announced.add(update);
      setFilled(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, filled, update]);

  if (!visible) return null;
  return (
    <Alert
      tone="info"
      action={
        filled && (
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              loading={updating}
              loadingLabel={t("update.updating")}
              onClick={() => {
                setUpdating(true);
                void update.apply();
              }}
            >
              {t("update.action")}
            </Button>
            <Button variant="ghost" size="sm" disabled={updating} onClick={() => update.postpone()}>
              {t("update.later")}
            </Button>
          </div>
        )
      }
    >
      {filled && t("update.notice")}
    </Alert>
  );
}
