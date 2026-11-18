import clsx from "clsx";
import { X } from "lucide-react";
import {
  I18nProvider,
  Text,
  UNSTABLE_Toast,
  UNSTABLE_ToastContent,
  UNSTABLE_ToastQueue,
  UNSTABLE_ToastRegion,
} from "react-aria-components";
import { useLocale } from "../../locale/LocaleProvider";
import { Button } from "../Button/Button";
import styles from "./Toast.module.css";

// react-aria's toast is still `UNSTABLE_` in 1.22, so this is the only file that imports it: if
// its API changes, nothing outside this folder does. react-aria types `className` as a plain
// string; CSS Module lookups are `string | undefined`, so they go through clsx.

export interface ToastContent {
  /** What just happened, already translated ("You deleted Milk"). */
  message: string;
  /** One way to reverse it, such as "Undo". Pressing it runs `onAction` and closes the toast. */
  action?: { label: string; onAction: () => void };
}

/**
 * How long a toast stays when nobody touches it. Long enough to read a short sentence and reach
 * "Undo" with a thumb; it waits while the pointer or keyboard focus is on it.
 */
export const TOAST_TIMEOUT_MS = 8000;

/**
 * Where the app sends toasts. Create one for the whole app and pass it to `ToastRegion`. It shows
 * one toast at a time: a new one replaces the one showing, so an action such as "Undo" is always
 * about the last thing that happened.
 */
export class ToastQueue extends UNSTABLE_ToastQueue<ToastContent> {
  constructor() {
    super({ maxVisibleToasts: 1 });
  }

  /** Shows `content` for `TOAST_TIMEOUT_MS`, replacing the toast showing. Returns its key. */
  show(content: ToastContent): string {
    this.clear();
    return this.add(content, { timeout: TOAST_TIMEOUT_MS });
  }
}

export interface ToastRegionProps {
  queue: ToastQueue;
  /** Accessible name of the region that holds the toasts, already translated ("Notifications"). */
  label: string;
  /** Accessible name of each toast's close (×) button, already translated. */
  closeLabel: string;
  /**
   * Switches every toast's action off while it can't work (offline, for instance). The region
   * lives outside the page, so a disabled fieldset around the page doesn't reach it.
   */
  actionDisabled?: boolean | undefined;
  /** Id of the element that says why the action is off, so it is read with the button. */
  actionDescribedBy?: string | undefined;
  /** Extra room the app needs below the toasts, such as a tab bar fixed to the bottom. */
  className?: string | undefined;
}

/**
 * A short message at the bottom of the screen about something that just happened, with at most
 * one action ("Undo"). Built on react-aria: the region is a landmark (F6 reaches it), each toast is
 * announced when it appears, and its timer waits while the person hovers or focuses it.
 */
export function ToastRegion({
  queue,
  label,
  closeLabel,
  actionDisabled = false,
  actionDescribedBy,
  className,
}: ToastRegionProps) {
  const locale = useLocale();
  return (
    <I18nProvider locale={locale}>
      <UNSTABLE_ToastRegion queue={queue} aria-label={label} className={clsx(styles.region, className)}>
        {({ toast }) => (
          <UNSTABLE_Toast toast={toast} className={clsx(styles.toast)}>
            <UNSTABLE_ToastContent className={clsx(styles.content)}>
              <Text slot="title" className={clsx(styles.message)}>
                {toast.content.message}
              </Text>
            </UNSTABLE_ToastContent>
            <div className={styles.actions}>
              {toast.content.action && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={actionDisabled}
                  aria-describedby={actionDisabled ? actionDescribedBy : undefined}
                  onClick={() => {
                    toast.content.action?.onAction();
                    queue.close(toast.key);
                  }}
                >
                  {toast.content.action.label}
                </Button>
              )}
              <button
                type="button"
                className={styles.close}
                aria-label={closeLabel}
                onClick={() => queue.close(toast.key)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </UNSTABLE_Toast>
        )}
      </UNSTABLE_ToastRegion>
    </I18nProvider>
  );
}
