import { Spinner } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import styles from "./FullPageLoading.module.css";

/** Shown while we find out whether someone is signed in. */
export function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <main className={styles.page}>
      <Spinner size="lg" label={t("loading")} />
    </main>
  );
}
