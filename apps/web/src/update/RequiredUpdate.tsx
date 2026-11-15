import { Button, WakeUpScreen } from "@hogar/ui";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ApiClient } from "../api/client";

const reloadPage = () => window.location.reload();

export interface RequiredUpdateGateProps {
  client: ApiClient;
  /** What "Update" does. Defaults to reloading, which loads the newest version. */
  onUpdate?: () => void;
  children: ReactNode;
}

/**
 * Renders the app until the API says this version is too old for it (`client.outdated`), then only
 * the required update screen. It can't be dismissed: nothing would work against the server anyway.
 */
export function RequiredUpdateGate({ client, onUpdate = reloadPage, children }: RequiredUpdateGateProps) {
  const subscribe = useCallback((onChange: () => void) => client.onOutdated(onChange), [client]);
  const outdated = useSyncExternalStore(subscribe, () => client.isOutdated);
  return outdated ? <RequiredUpdate onUpdate={onUpdate} /> : children;
}

/** The full-page scene the wake-up screen uses, resting, with one way forward. */
function RequiredUpdate({ onUpdate }: { onUpdate: () => void }) {
  const { t } = useTranslation();
  // It starts empty and fills in a moment later, so screen readers announce the live status.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <WakeUpScreen
      mood="resting"
      revealed={revealed}
      status={t("update.required.title")}
      description={t("update.required.description")}
      action={<Button onClick={onUpdate}>{t("update.action")}</Button>}
    />
  );
}
