import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./Menu.module.css";

export interface MenuProps {
  /** The element that opens the menu. It must be a focusable control with an accessible name. */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}

/**
 * A list of actions that opens from a button. Built on Radix, so it handles keyboard navigation,
 * focus return and screen reader roles; we only add the Hogar look.
 */
export function Menu({ trigger, children, align = "end" }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align={align} sideOffset={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function MenuItem({ children, onSelect, icon, disabled, className }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={clsx(styles.item, className)}
      disabled={disabled ?? false}
      {...(onSelect ? { onSelect } : {})}
    >
      {icon && (
        <span className={styles.itemIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </DropdownMenu.Item>
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
  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.label}>{label}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onValueChange(next as T)}>
        {options.map((option) => (
          <DropdownMenu.RadioItem key={option.value} value={option.value} className={styles.item}>
            {option.icon && (
              <span className={styles.itemIcon} aria-hidden="true">
                {option.icon}
              </span>
            )}
            {option.label}
            <DropdownMenu.ItemIndicator className={styles.indicator} aria-hidden="true">
              <span className={styles.dot} />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Group>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}
