import { Alert, Button } from "@hogar/ui";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAppUpdate } from "./appUpdate";

/**
 * The quiet update notice: once a new version has downloaded, it offers to switch now or later.
 * It never reloads by itself, so nothing being typed is lost; left for later, the new version
 * takes over the next time Hogar opens.
 */
export function UpdateNotice() {
  const { t } = useTranslation();
  const update = useAppUpdate();
  const ready = useSyncExternalStore(
    (onChange) => update.onReadyChange(onChange),
    () => update.ready,
  );
  const [later, setLater] = useState(false);
  if (!ready || later) return null;
  return (
    <Alert
      tone="info"
      action={
        <>
          <Button variant="secondary" size="sm" onClick={() => void update.apply()}>
            {t("update.action")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLater(true)}>
            {t("update.later")}
          </Button>
        </>
      }
    >
      {t("update.notice")}
    </Alert>
  );
}
