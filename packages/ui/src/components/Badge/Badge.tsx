import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./Badge.module.css";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "positive" | "negative" | "warning";
}

/** A short status label. The text always carries the meaning; the tone only reinforces it. */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <span className={clsx(styles.badge, styles[tone], className)} {...rest} />;
}
