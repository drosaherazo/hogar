import { Card, Spinner } from "@hogar/ui";
import { useMutation } from "@tanstack/react-query";
import { ListChecks, ShoppingBasket, Wallet } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { GoogleSignInButton } from "../../auth/GoogleSignInButton";
import { HogarMark } from "../../layout/HogarMark";
import { PreferencesBar } from "../../layout/PreferencesBar";
import styles from "./LoginPage.module.css";

export interface LoginPageProps {
  googleClientId: string | undefined;
}

/** Sign in with Google. Warm and brief: what Hogar is, one button, and what we do with your data. */
export function LoginPage({ googleClientId }: LoginPageProps) {
  const { t } = useTranslation(["auth", "errors"]);
  const { loginWithGoogle } = useAuth();
  const login = useMutation({ mutationFn: loginWithGoogle });
  const onCredential = useCallback((credential: string) => login.mutate(credential), [login]);

  const benefits = [
    { icon: <Wallet />, text: t("login.benefits.expenses") },
    { icon: <ListChecks />, text: t("login.benefits.chores") },
    { icon: <ShoppingBasket />, text: t("login.benefits.shopping") },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Card as="section" padding="lg" elevated className={styles.card} aria-labelledby="login-title">
          <div className={styles.heading}>
            <HogarMark size="lg" />
            <h1 id="login-title" className={styles.title}>
              {t("login.title")}
            </h1>
            <p className={styles.tagline}>{t("login.tagline")}</p>
          </div>

          <ul className={styles.benefits} aria-label={t("login.benefits.label")}>
            {benefits.map(({ icon, text }) => (
              <li key={text} className={styles.benefit}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  {icon}
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className={styles.signIn}>
            {login.isPending ? (
              <div className={styles.pending}>
                <Spinner label={t("login.signingIn")} />
                <span aria-hidden="true">{t("login.signingIn")}</span>
              </div>
            ) : (
              <GoogleSignInButton clientId={googleClientId} onCredential={onCredential} />
            )}
            {login.isError && (
              <p className={styles.error} role="alert">
                {t(errorKey(login.error))}
              </p>
            )}
            <p className={styles.privacy}>{t("login.privacy")}</p>
          </div>
        </Card>
      </main>
      <footer className={styles.footer}>
        <PreferencesBar />
      </footer>
    </div>
  );
}
