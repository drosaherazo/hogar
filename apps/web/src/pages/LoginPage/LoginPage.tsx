import { Card, Spinner } from "@hogar/ui";
import { useMutation } from "@tanstack/react-query";
import { ListChecks, ShoppingBasket, Wallet } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { errorKey } from "../../api/client";
import { googleLooks, lookFor } from "../../auth/googleButtonVariants.prototype";
import { PrototypeSwitcher } from "../../prototype/PrototypeSwitcher";
import { useAuth } from "../../auth/AuthProvider";
import { GoogleSignInButton } from "../../auth/GoogleSignInButton";
import { HogarMark } from "../../layout/HogarMark";
import { PreferencesBar } from "../../layout/PreferencesBar";
import { EmailSignIn } from "./EmailSignIn";
import styles from "./LoginPage.module.css";

export interface LoginPageProps {
  googleClientId: string | undefined;
}

/**
 * Sign in with Google or with a code by email. Friendly and brief: what Hogar is, the two ways in,
 * and what we do with your data.
 */
export function LoginPage({ googleClientId }: LoginPageProps) {
  const { t } = useTranslation(["auth", "errors"]);
  const { loginWithGoogle } = useAuth();
  const login = useMutation({ mutationFn: loginWithGoogle });
  const onCredential = useCallback((credential: string) => login.mutate(credential), [login]);
  // PROTOTYPE: ?variant= picks the Google button look.
  const [params] = useSearchParams();
  const variant = params.get("variant") ?? "A";
  const look = lookFor(variant);

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
              <GoogleSignInButton clientId={googleClientId} onCredential={onCredential} look={look} />
            )}
            {login.isError && (
              <p className={styles.error} role="alert">
                {t(errorKey(login.error))}
              </p>
            )}
            <p className={styles.privacy}>{t("login.privacy")}</p>
          </div>

          <p className={styles.divider}>
            <span>{t("login.or")}</span>
          </p>

          <EmailSignIn />
        </Card>
      </main>
      <footer className={styles.footer}>
        <PreferencesBar />
      </footer>
      {import.meta.env.DEV && (
        <PrototypeSwitcher
          variants={Object.entries(googleLooks).map(([key, { name }]) => ({ key, name }))}
          current={variant}
        />
      )}
    </div>
  );
}
