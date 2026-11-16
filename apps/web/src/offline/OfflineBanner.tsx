import { Alert, useFormattingLocale } from "@hogar/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHousehold } from "../household/useHousehold";
import { formatAgo } from "../i18n/format";
import { useReadOnly } from "./useOnline";

/** The element that says why changes are off, so disabled actions can point to it. */
export const OFFLINE_REASON_ID = "offline-reason";

/**
 * The offline view's banner (ADR 0015): Hogar is offline, the data on screen is what it last
 * loaded and when, and changes wait until the connection is back. Neutral, never alarming.
 */
export function OfflineBanner() {
  const readOnly = useReadOnly();
  if (!readOnly) return null;
  return <Banner />;
}

function Banner() {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const { dataUpdatedAt } = useHousehold();
  // Read when the banner appears (and on every page), not ticking: a live region whose text
  // changed every minute would be read out again every minute.
  const [now] = useState(() => Date.now());
  const time = now - dataUpdatedAt < 60_000 ? t("offline.justNow") : formatAgo(dataUpdatedAt, now, locale);
  // It starts empty and fills in a moment later, so screen readers announce it.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Alert tone="info">
      {filled && (
        <>
          {t("offline.banner", { time })} <span id={OFFLINE_REASON_ID}>{t("offline.actionDisabled")}</span>
        </>
      )}
    </Alert>
  );
}
