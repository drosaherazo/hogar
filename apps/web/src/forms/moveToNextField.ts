import type { KeyboardEvent } from "react";

const TEXT_ENTRY_TYPES = new Set(["text", "email", "number", "search", "tel", "url", "password"]);

function isTextEntry(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  const typed = element instanceof HTMLInputElement && TEXT_ENTRY_TYPES.has(element.type);
  return (typed || element instanceof HTMLTextAreaElement) && !element.disabled && !element.readOnly;
}

/** The enter key for one of several fields typed in a row: "next" until the last one, then "done". */
export function enterKeyFor(index: number, count: number): "next" | "done" {
  return index < count - 1 ? "next" : "done";
}

/**
 * Keeps a phone keyboard's "next" key honest. Attach it to a form's `onKeyDown`: Enter in a field
 * with `enterKeyHint="next"` moves to the form's next field that takes typing, instead of
 * submitting the form (iOS only relabels the key; it still sends Enter). Fields whose Enter
 * submits the form say so with "done", "send" or "go".
 */
export function moveToNextField(event: KeyboardEvent<HTMLFormElement>) {
  const field = event.target;
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  if (!(field instanceof HTMLInputElement) || field.getAttribute("enterkeyhint") !== "next") return;
  const fields = [...event.currentTarget.elements].filter(isTextEntry);
  const next = fields[fields.indexOf(field) + 1];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
