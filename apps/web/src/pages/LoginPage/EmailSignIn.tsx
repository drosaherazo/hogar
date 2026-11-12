import { emailAddressSchema, errorCodeFrom, normalizeEmail, resolveLocale, signInCodeSchema } from "@hogar/shared";
import { Button, TextField } from "@hogar/ui";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, errorKey } from "../../api/client";
import { useApiClient } from "../../api/ApiClientContext";
import { useAuth } from "../../auth/AuthProvider";
import styles from "./LoginPage.module.css";

/** The API allows one code a minute per address; after a successful send the web waits as long. */
const RESEND_AFTER_SECONDS = 60;

/** A countdown in whole seconds that ticks once a second; `start(n)` restarts it from `n`. */
function useCountdown(): [secondsLeft: number, start: (seconds: number) => void] {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setUntil(current + seconds * 1000);
  }, []);
  useEffect(() => {
    if (until === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return [until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000)), start];
}

/**
 * Sign in with a code sent by email (ADR 0008): type your address, get a 6-digit code, type it.
 * Both steps live on the login page, with no new route, so a visitor from an invitation returns
 * to it like after Google. Every error sits next to the field it is about, in kind words.
 */
export function EmailSignIn() {
  const { t, i18n } = useTranslation(["auth", "errors"]);
  const client = useApiClient();
  const { signInWithEmailCode } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [resendError, setResendError] = useState<string>();
  const [secondsLeft, startCountdown] = useCountdown();
  // The API limits codes per address, so the countdown belongs to the address it was started for.
  const [waitingAddress, setWaitingAddress] = useState("");
  const waitFor = (address: string, seconds: number) => {
    setWaitingAddress(address);
    startCountdown(seconds);
  };
  const waitingFor = (address: string) => secondsLeft > 0 && normalizeEmail(address) === waitingAddress;
  const waitLabel = () =>
    t("login.code.resendIn", {
      time: new Intl.NumberFormat(i18n.resolvedLanguage, { style: "unit", unit: "second" }).format(secondsLeft),
    });

  const emailField = useRef<HTMLInputElement>(null);
  const codeField = useRef<HTMLInputElement>(null);

  // Move focus to the field of the step the person just reached; never on page load, where it
  // would pop up a phone keyboard before the person has chosen how to sign in.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    (step === "code" ? codeField : emailField).current?.focus();
  }, [step]);

  const send = useMutation({
    mutationFn: (address: string) => client.requestEmailCode(address, resolveLocale(i18n.resolvedLanguage)),
    onSuccess: (_, address) => {
      setSentTo(address);
      waitFor(address, RESEND_AFTER_SECONDS);
      setStep("code");
    },
    onError: (error, address) => {
      if (error instanceof ApiRequestError && error.retryAfterSeconds) waitFor(address, error.retryAfterSeconds);
    },
  });

  const signIn = useMutation({
    mutationFn: (typed: string) => signInWithEmailCode(sentTo, typed),
    onError: (error) => {
      setCodeError(t(errorKey(error)));
      codeField.current?.focus();
    },
  });

  function submitEmail(event: FormEvent) {
    event.preventDefault();
    const parsed = emailAddressSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(t(`errors:${errorCodeFrom(parsed.error)}`));
      emailField.current?.focus();
      return;
    }
    setEmailError(undefined);
    send.mutate(parsed.data, {
      onError: (error) => {
        setEmailError(t(errorKey(error)));
        emailField.current?.focus();
      },
    });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    const parsed = signInCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(t(`errors:${errorCodeFrom(parsed.error)}`));
      codeField.current?.focus();
      return;
    }
    setCodeError(undefined);
    signIn.mutate(parsed.data);
  }

  function resend() {
    setResendError(undefined);
    setCodeError(undefined);
    setCode("");
    send.mutate(sentTo, {
      onSuccess: () => codeField.current?.focus(),
      onError: (error) => setResendError(t(errorKey(error))),
    });
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setCodeError(undefined);
    setResendError(undefined);
    send.reset();
    signIn.reset();
  }

  if (step === "email") {
    return (
      <form className={styles.emailForm} onSubmit={submitEmail} noValidate>
        <TextField
          ref={emailField}
          label={t("login.email.label")}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(undefined);
          }}
          error={emailError}
        />
        <Button
          type="submit"
          fullWidth
          disabled={waitingFor(email)}
          loading={send.isPending}
          loadingLabel={t("login.email.sending")}
        >
          {waitingFor(email) ? waitLabel() : t("login.email.submit")}
        </Button>
        <p className={styles.privacy}>{t("login.email.privacy")}</p>
      </form>
    );
  }

  return (
    <section className={styles.codeStep} aria-labelledby="login-code-title">
      <h2 id="login-code-title" className={styles.codeTitle}>
        {t("login.code.title")}
      </h2>
      <p className={styles.sentTo}>{t("login.code.sentTo", { email: sentTo })}</p>
      <form className={styles.emailForm} onSubmit={submitCode} noValidate>
        <TextField
          ref={codeField}
          label={t("login.code.label")}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setCodeError(undefined);
          }}
          error={codeError}
          hint={t("login.code.spamHint")}
          className={styles.codeField}
        />
        <Button type="submit" fullWidth loading={signIn.isPending} loadingLabel={t("login.code.checking")}>
          {t("login.code.submit")}
        </Button>
      </form>
      <div className={styles.codeActions}>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={resend}
          disabled={waitingFor(sentTo)}
          loading={send.isPending}
          loadingLabel={t("login.email.sending")}
        >
          {waitingFor(sentTo) ? waitLabel() : t("login.code.resend")}
        </Button>
        {resendError && (
          <p className={styles.error} role="alert">
            {resendError}
          </p>
        )}
        <Button type="button" variant="ghost" fullWidth onClick={changeEmail}>
          {t("login.code.changeEmail")}
        </Button>
      </div>
    </section>
  );
}
