import clsx from "clsx";
import { useId, type ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  /** Short, friendly headline, already translated. */
  title: string;
  /** What this space is for and what to do next. */
  description?: ReactNode;
  /** Decorative illustration or icon. */
  icon?: ReactNode;
  /** Next steps, usually one primary and one secondary button. */
  actions?: ReactNode;
  /** Heading level that fits the page outline. */
  headingLevel?: 2 | 3;
  className?: string;
}

/** Turns "there's nothing here yet" into a warm invitation with a clear next step. */
export function EmptyState({ title, description, icon, actions, headingLevel = 2, className }: EmptyStateProps) {
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={clsx(styles.emptyState, className)} aria-labelledby={titleId}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <div className={styles.text}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}
