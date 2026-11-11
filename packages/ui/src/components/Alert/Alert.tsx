import clsx from "clsx";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Alert.module.css";

export interface AlertProps {
  /** `info` for neutral news, `warning` for something to review, `danger` for something that failed. */
  tone: "info" | "warning" | "danger";
  /** Optional short heading, already translated. */
  title?: string;
  /** The message, already translated. */
  children: ReactNode;
  /** An optional button or link that resolves the message. */
  action?: ReactNode;
  className?: string;
}

const ICONS = { info: Info, warning: TriangleAlert, danger: CircleAlert } as const;

/** An inline message inside the page. Icon plus text always, so color is never the only signal. */
export function Alert({ tone, title, children, action, className }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    // Problems interrupt (role="alert"); everything else waits for a pause (role="status").
    <div role={tone === "danger" ? "alert" : "status"} className={clsx(styles.alert, styles[tone], className)}>
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        <div className={styles.message}>{children}</div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
