import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalePreference } from "../i18n";
import { useTheme } from "../theme/theme";
import styles from "./GoogleSignInButton.module.css";
import { loadGoogleIdentity } from "./loadGoogleIdentity";

export interface GoogleSignInButtonProps {
  clientId: string | undefined;
  onCredential: (credential: string) => void;
}

const BUTTON_WIDTH = 300;

/**
 * Google's official sign-in button (Google Identity Services).
 * It follows our theme and language, and hands us a signed ID token for the API to verify.
 */
export function GoogleSignInButton({ clientId, onCredential }: GoogleSignInButtonProps) {
  const { t } = useTranslation("auth");
  const { theme } = useTheme();
  const { locale } = useLocalePreference();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogleIdentity().then(
      () => {
        const id = window.google?.accounts.id;
        if (!active || !id || !container.current) return;
        id.initialize({
          client_id: clientId,
          callback: ({ credential }) => callback.current(credential),
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          context: "signin",
        });
        container.current.replaceChildren();
        id.renderButton(container.current, {
          type: "standard",
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width: BUTTON_WIDTH,
          locale,
        });
      },
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [clientId, theme, locale]);

  if (!clientId) {
    return (
      <p className={styles.notice} role="alert">
        {t("login.missingClientId")}
      </p>
    );
  }
  if (failed) {
    return (
      <p className={styles.notice} role="alert">
        {t("login.googleUnavailable")}
      </p>
    );
  }
  return <div ref={container} className={styles.button} data-testid="google-sign-in" />;
}
