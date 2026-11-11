import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode, type RefObject } from "react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  /** Whether the dialog is showing. The app owns this state and opens it from its own button. */
  open: boolean;
  /** Called with `false` when the person closes it (Escape, the × button or outside the dialog). */
  onOpenChange: (open: boolean) => void;
  /** Says exactly what the dialog is about, already translated ("Leave Casa Ana?"). */
  title: string;
  /** One or two sentences with the consequence, already translated. */
  description?: string;
  /** Accessible name of the close (×) button, already translated. */
  closeLabel: string;
  /** The body, such as a short form. */
  children?: ReactNode;
  /**
   * Buttons at the bottom. Put the safe choice ("Cancel") first: it gets focus when the dialog
   * opens, so pressing Enter by reflex never confirms something destructive.
   */
  actions?: ReactNode;
  /** Where focus goes on open instead of the first action, typically a form's first field. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * A modal for confirmations and short forms. Built on Radix: it traps focus, closes with
 * Escape, hides the page from screen readers while open and returns focus afterwards.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  actions,
  initialFocus,
}: DialogProps) {
  // Dialogs here are opened from ordinary buttons, not a Radix Trigger, so Radix wouldn't know
  // where to send focus on close. Remember what had focus and go back to it.
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const footer = useRef<HTMLElement>(null);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          onOpenAutoFocus={(event) => {
            returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            // Radix would focus the first focusable element, the close (×) button. Prefer the
            // requested element, else the first action (the safe choice).
            const target = initialFocus?.current ?? footer.current?.querySelector<HTMLElement>("button:not(:disabled)");
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocusTo.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className={styles.header}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            <RadixDialog.Close className={styles.close} aria-label={closeLabel}>
              <X aria-hidden="true" />
            </RadixDialog.Close>
          </header>
          {description && (
            <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>
          )}
          {children && <div className={styles.body}>{children}</div>}
          {actions && (
            <footer ref={footer} className={styles.actions}>
              {actions}
            </footer>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
