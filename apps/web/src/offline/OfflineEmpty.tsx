import { WakeUpScreen } from "@hogar/ui";
import { useTranslation } from "react-i18next";

/**
 * What Hogar shows offline with nothing kept to show: a friendly, still scene instead of a blank
 * or broken page, never the wake-up screen (there is no server to wait for).
 */
export function OfflineEmpty() {
  const { t } = useTranslation();
  return <WakeUpScreen mood="resting" status={t("offline.empty.title")} description={t("offline.empty.description")} />;
}
