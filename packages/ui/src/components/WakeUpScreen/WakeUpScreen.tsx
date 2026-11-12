import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./WakeUpScreen.module.css";

export interface WakeUpScreenProps {
  /** Current status, already translated. Rendered as the page's h1 inside a polite live region. */
  status: string;
  /** Why it is happening and what to expect. Not part of the live region, so it isn't re-read. */
  description?: ReactNode;
  /** Visible label above the tip ("Quick tip"). */
  tipLabel?: string;
  /** One short tip. Not announced when it changes; it fades in (no motion when reduced). */
  tip?: string;
  /** Next step, usually one Button ("Try again"). */
  action?: ReactNode;
  /** `waking` animates the house; `resting` shows it still, lights off (slow and offline states). */
  mood?: "waking" | "resting";
  /**
   * `false` renders a calm, empty page that already holds the live region, so the first status
   * is announced when it arrives (screen readers often skip regions that appear already filled).
   * Default `true`.
   */
  revealed?: boolean;
  className?: string;
}

/**
 * A full-page scene for the moments Hogar waits for its server: a little house lighting up,
 * an honest status and a tip, so the wait is explained instead of an endless spinner.
 */
export function WakeUpScreen({
  status,
  description,
  tipLabel,
  tip,
  action,
  mood = "waking",
  revealed = true,
  className,
}: WakeUpScreenProps) {
  const waking = mood === "waking";
  return (
    <main className={clsx(styles.screen, className)} aria-busy={waking || undefined}>
      <div className={styles.content}>
        {revealed && <HouseIllustration animated={waking} />}
        <div className={styles.text}>
          <div role="status">{revealed && <h1 className={styles.status}>{status}</h1>}</div>
          {revealed && description && <p className={styles.description}>{description}</p>}
        </div>
        {revealed && tip && (
          <div key={tip} className={styles.tip}>
            {tipLabel && <p className={styles.tipLabel}>{tipLabel}</p>}
            <p className={styles.tipText}>{tip}</p>
          </div>
        )}
        {revealed && action && <div className={styles.action}>{action}</div>}
      </div>
    </main>
  );
}

/** The Hogar house, drawn with theme tokens: windows light up one by one and the chimney smokes. */
function HouseIllustration({ animated }: { animated: boolean }) {
  return (
    <svg
      className={clsx(styles.illustration, animated ? styles.animated : styles.resting)}
      viewBox="0 0 120 100"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.smoke}>
        <circle className={styles.puff} cx="83" cy="17" r="3" />
        <circle className={styles.puff} cx="86" cy="13" r="4" />
        <circle className={styles.puff} cx="82" cy="8" r="3" />
      </g>
      <rect className={styles.house} x="78" y="22" width="10" height="22" rx="2" />
      <path className={styles.house} d="M20 52 60 19l40 33v36a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" />
      <rect className={styles.window} x="31" y="58" width="15" height="13" rx="2" />
      <rect className={styles.window} x="74" y="58" width="15" height="13" rx="2" />
      <circle className={styles.window} cx="60" cy="42" r="6" />
      <rect className={clsx(styles.light, styles.light1)} x="31" y="58" width="15" height="13" rx="2" />
      <circle className={clsx(styles.light, styles.light2)} cx="60" cy="42" r="6" />
      <rect className={clsx(styles.light, styles.light3)} x="74" y="58" width="15" height="13" rx="2" />
      <rect className={styles.door} x="53" y="66" width="14" height="26" rx="3" />
      <line className={styles.ground} x1="8" y1="92" x2="112" y2="92" />
    </svg>
  );
}
