import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from "react-aria-components";
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
 * A modal for confirmations and short forms. Built on react-aria: it traps focus, closes with
 * Escape or a click outside, hides the page from screen readers while open and returns focus
 * afterwards to whatever had it before, such as the button that opened it.
 */
export function Dialog({ open, onOpenChange, ...content }: DialogProps) {
  const descriptionId = useId();

  // react-aria types `className` as a plain string; CSS Module lookups are `string | undefined`,
  // so they go through clsx here and in DialogContent.
  return (
    <ModalOverlay isOpen={open} onOpenChange={onOpenChange} isDismissable className={clsx(styles.overlay)}>
      <Modal>
        <AriaDialog
          className={clsx(styles.content)}
          {...(content.description ? { "aria-describedby": descriptionId } : {})}
        >
          <DialogContent {...content} descriptionId={descriptionId} onClose={() => onOpenChange(false)} />
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

type DialogContentProps = Omit<DialogProps, "open" | "onOpenChange"> & {
  descriptionId: string;
  onClose: () => void;
};

/**
 * The dialog's inside. It is its own component so its focus effect runs once the dialog is
 * mounted, and before react-aria's.
 */
function DialogContent({
  title,
  description,
  descriptionId,
  closeLabel,
  onClose,
  children,
  actions,
  initialFocus,
}: DialogContentProps) {
  const footer = useRef<HTMLElement>(null);

  // react-aria focuses the dialog itself on open unless something inside already has focus.
  // Effects run children first, so this one wins: the requested element, else the first action
  // (the safe choice), else react-aria's fallback.
  useEffect(() => {
    const target = initialFocus?.current ?? footer.current?.querySelector<HTMLElement>("button:not(:disabled)");
    target?.focus();
  }, [initialFocus]);

  return (
    <>
      <header className={styles.header}>
        <Heading slot="title" className={clsx(styles.title)}>
          {title}
        </Heading>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
      {children && <div className={styles.body}>{children}</div>}
      {actions && (
        <footer ref={footer} className={styles.actions}>
          {actions}
        </footer>
      )}
    </>
  );
}
