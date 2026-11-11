import clsx from "clsx";
import { useId, type ReactNode, type Ref } from "react";
import styles from "./ChoiceGroup.module.css";

export interface ChoiceOption {
  value: string;
  /** Visible label, already translated. */
  label: string;
  /** One line of extra context under the label, already translated. Read together with the option. */
  hint?: string | undefined;
  /** Shown but not selectable; give a `hint` explaining why. */
  disabled?: boolean | undefined;
  /** Something to show at the end of the row, such as a person's share. */
  trailing?: ReactNode;
}

interface CommonProps {
  /** Names the whole group ("How should it be split?"), already translated. */
  legend: string;
  options: readonly ChoiceOption[];
  /** Form field name; generated when omitted. */
  name?: string;
  /**
   * Attached to the selected option (or the first one), so a dialog can start there with
   * `initialFocus`.
   */
  initialFocusRef?: Ref<HTMLInputElement>;
  className?: string;
}

export interface SingleChoiceGroupProps extends CommonProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

export interface MultipleChoiceGroupProps extends CommonProps {
  multiple: true;
  value: readonly string[];
  /** The selected values, in the options' order. */
  onChange: (value: string[]) => void;
}

export type ChoiceGroupProps = SingleChoiceGroupProps | MultipleChoiceGroupProps;

/**
 * A labelled group of options shown as cards: pick one (radios) or several (`multiple`,
 * checkboxes). Native inputs, so keyboards, screen readers and phones handle them as usual.
 */
export function ChoiceGroup(props: ChoiceGroupProps) {
  const { legend, options, initialFocusRef, className } = props;
  const generatedName = useId();
  const name = props.name ?? generatedName;

  const isChecked = (value: string) => (props.multiple ? props.value.includes(value) : props.value === value);
  const focusValue = options.find((option) => isChecked(option.value))?.value ?? options[0]?.value;

  function toggle(value: string) {
    if (!props.multiple) {
      props.onChange(value);
      return;
    }
    const selected = new Set(props.value);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    props.onChange(options.map((option) => option.value).filter((option) => selected.has(option)));
  }

  return (
    <fieldset className={clsx(styles.group, className)}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((option) => {
        const labelId = `${name}-${option.value}-label`;
        const hintId = `${name}-${option.value}-hint`;
        return (
          <label key={option.value} className={clsx(styles.choice, option.disabled && styles.disabled)}>
            <input
              ref={option.value === focusValue ? initialFocusRef : undefined}
              type={props.multiple ? "checkbox" : "radio"}
              name={name}
              value={option.value}
              checked={isChecked(option.value)}
              disabled={option.disabled}
              onChange={() => toggle(option.value)}
              // The card's label wraps the hint and trailing content too; name the input by its label alone.
              aria-labelledby={labelId}
              aria-describedby={option.hint ? hintId : undefined}
              className={styles.input}
            />
            <span className={styles.text}>
              <span id={labelId} className={styles.label}>
                {option.label}
              </span>
              {option.hint && (
                <span id={hintId} className={styles.hint}>
                  {option.hint}
                </span>
              )}
            </span>
            {option.trailing !== undefined && <span className={styles.trailing}>{option.trailing}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
