import { Alert } from "@hogar/ui";
import { useFormattingLocale } from "@hogar/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHousehold } from "../household/useHousehold";
import { formatAgo } from "../i18n/format";
import { useOnline } from "./useOnline";

/** The element that says why changes are off, so disabled actions can point to it. */
export const OFFLINE_REASON_ID = "offline-reason";

/** Re-reads the clock every minute, so "5 minutes ago" keeps telling the truth. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The offline view's banner (ADR 0015): Hogar is offline, the data on screen is what it last
 * loaded and when, and changes wait until the connection is back. Neutral, never alarming.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return <Banner />;
}

function Banner() {
  const { t } = useTranslation();
  const locale = useFormattingLocale();
  const { dataUpdatedAt } = useHousehold();
  const now = useMinute();
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
          {t("offline.banner", { time: formatAgo(dataUpdatedAt, now, locale) })}{" "}
          <span id={OFFLINE_REASON_ID}>{t("offline.actionDisabled")}</span>
        </>
      )}
    </Alert>
  );
}
