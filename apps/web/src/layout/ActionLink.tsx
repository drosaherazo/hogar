import clsx from "clsx";
import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { OFFLINE_REASON_ID } from "../offline/OfflineBanner";
import { useOnline } from "../offline/useOnline";
import styles from "./ActionLink.module.css";

export interface ActionLinkProps extends LinkProps {
  /** `primary` for a screen's main action (one per screen), like a primary button. */
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
  /** It leads to creating or editing something, so it is off while Hogar is offline (ADR 0015). */
  changesData?: boolean;
}

/** Navigation that looks like a button. It stays a real link, so it opens in new tabs and reads as a link. */
export function ActionLink({
  variant = "secondary",
  icon,
  changesData = false,
  className,
  children,
  ...rest
}: ActionLinkProps) {
  const online = useOnline();
  const content = (
    <>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </>
  );
  if (changesData && !online) {
    // A link with no address can't be followed; aria-disabled keeps it findable, with the reason.
    return (
      <a
        className={clsx(styles.link, styles[variant], styles.disabled, className)}
        aria-disabled="true"
        aria-describedby={OFFLINE_REASON_ID}
      >
        {content}
      </a>
    );
  }
  return (
    <Link className={clsx(styles.link, styles[variant], className)} {...rest}>
      {content}
    </Link>
  );
}
