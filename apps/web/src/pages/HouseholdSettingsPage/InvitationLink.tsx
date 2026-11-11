import { Button, TextField } from "@hogar/ui";
import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./HouseholdSettingsPage.module.css";

/** The full link for a token. The token goes after `#`, which browsers never send to servers. */
export function invitationUrl(token: string): string {
  return `${window.location.origin}/invite#${token}`;
}

/** Shows a freshly created link with a copy button. It can't be shown again later: only its hash is stored. */
export function InvitationLink({ token }: { token: string }) {
  const { t } = useTranslation("household");
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const url = invitationUrl(token);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      // No clipboard access (old browser, insecure context): select it so copying by hand is one step.
      setCopy("failed");
      input.current?.select();
    }
  }

  return (
    <div className={styles.form}>
      <TextField
        ref={input}
        label={t("settings.invitations.linkLabel")}
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className={styles.row}>
        <Button icon={copy === "copied" ? <Check /> : <Copy />} onClick={() => void copyLink()}>
          {t("settings.invitations.copy")}
        </Button>
        {copy !== "idle" && (
          <p className={copy === "copied" ? styles.saved : styles.muted} role="status">
            {copy === "copied" ? t("settings.invitations.copied") : t("settings.invitations.copyFailed")}
          </p>
        )}
      </div>
    </div>
  );
}
