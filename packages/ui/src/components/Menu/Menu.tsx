import clsx from "clsx";
import {
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type DOMAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Pressable,
  Separator,
  Text,
  type Selection,
} from "react-aria-components";
import styles from "./Menu.module.css";

// react-aria types `className` as a plain string; CSS Module lookups are `string | undefined`,
// so the classes passed to its components go through clsx.

export interface MenuProps {
  /** The element that opens the menu. It must be a focusable control with an accessible name. */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}

/**
 * A list of actions that opens from a button. Built on react-aria, so it handles keyboard
 * navigation, focus return and screen reader roles; we only add the Hogar look.
 */
export function Menu({ trigger, children, align = "end" }: MenuProps) {
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);

  // react-aria returns focus to the trigger a frame after the menu closes. Do it as soon as the
  // menu is gone instead, so focus never rests on the page in between. A dialog opened from an
  // item still takes focus afterwards, since its effects run after this one.
  useLayoutEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {/* The app passes its own button (a plain one or our Button, which forwards its ref and
          props); Pressable wires it up. The stories pass no trigger, hence the guard. */}
      {isValidElement(trigger) && (
        <Pressable ref={triggerRef}>{trigger as ReactElement<DOMAttributes<Element>, string>}</Pressable>
      )}
      <Popover className={clsx(styles.content)} placement={`bottom ${align}`} offset={8}>
        <AriaMenu className={clsx(styles.menu)}>{children}</AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export interface MenuItemProps {
  /** The action's name, already translated ("Edit"). */
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * A short line under the name, already translated, read with the item by screen readers. Use it
   * on a disabled item to say why it can't be used ("Only Bruno can change it while it's in their
   * cart."), so the person isn't left guessing.
   */
  description?: string | undefined;
  className?: string;
}

export function MenuItem({ children, onSelect, icon, disabled, description, className }: MenuItemProps) {
  return (
    <AriaMenuItem
      className={clsx(styles.item, className)}
      isDisabled={disabled ?? false}
      {...(typeof children === "string" ? { textValue: children } : {})}
      {...(onSelect ? { onAction: onSelect } : {})}
    >
      {icon && (
        <span className={styles.itemIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      {/* The label slot names the item; the description slot describes it, without joining the name.
          The slot is always there, empty and hidden without a description: react-aria links it only
          when the item mounts, so a reason that appears while the menu is open (an item switched off
          as the connection drops) is still read. */}
      <span className={styles.itemText}>
        <Text slot="label">{children}</Text>
        <Text slot="description" className={clsx(styles.itemDescription)}>
          {description}
        </Text>
      </span>
    </AriaMenuItem>
  );
}

export interface MenuRadioGroupProps<T extends string> {
  /** Visible group title, already translated ("Language"). */
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
}

/** A set of mutually exclusive options inside a menu, like the theme or the language. */
export function MenuRadioGroup<T extends string>({ label, value, onValueChange, options }: MenuRadioGroupProps<T>) {
  const select = (selection: Selection) => {
    // Single selection that can't be emptied: the set always holds exactly one option.
    const [next] = selection === "all" ? [] : selection;
    if (next !== undefined) onValueChange(String(next) as T);
  };

  return (
    <MenuSection selectionMode="single" disallowEmptySelection selectedKeys={[value]} onSelectionChange={select}>
      <Header className={clsx(styles.label)}>{label}</Header>
      {options.map((option) => (
        <AriaMenuItem key={option.value} id={option.value} textValue={option.label} className={clsx(styles.item)}>
          {({ isSelected }) => (
            <>
              {option.icon && (
                <span className={styles.itemIcon} aria-hidden="true">
                  {option.icon}
                </span>
              )}
              {option.label}
              {isSelected && (
                <span className={styles.indicator} aria-hidden="true">
                  <span className={styles.dot} />
                </span>
              )}
            </>
          )}
        </AriaMenuItem>
      ))}
    </MenuSection>
  );
}

export function MenuSeparator() {
  return <Separator className={clsx(styles.separator)} />;
}
