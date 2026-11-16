import { Dialog } from "@hogar/ui";
import { Share, SquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./IosInstallSheet.module.css";

/**
 * iOS has no install button, so "Install Hogar" shows the two steps instead, each with the icon
 * the person will look for in their browser. A sheet on phones, like every dialog.
 */
export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("install.ios.title")} closeLabel={t("install.ios.close")}>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.icon} aria-hidden="true">
            <Share />
          </span>
          {t("install.ios.share")}
        </li>
        <li className={styles.step}>
          <span className={styles.icon} aria-hidden="true">
            <SquarePlus />
          </span>
          {t("install.ios.add")}
        </li>
      </ol>
    </Dialog>
  );
}
