import {
  errorCodeFrom,
  shoppingItemNameSchema,
  shoppingItemNoteSchema,
  shoppingNameKey,
  type ErrorCode,
} from "@hogar/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError } from "../../api/client";

type Field = "name" | "note";

/**
 * An item's name and note as the person types them, for adding one and for editing one: both are
 * checked with the shared schemas before anything is sent, and a name the list already has is kept
 * as `duplicateKey`, for the notice that offers the person's note to that item.
 */
export function useItemFields(initial: { name: string; note: string | null } = { name: "", note: null }) {
  const { t } = useTranslation("errors");
  const [name, setName] = useState(initial.name);
  const [note, setNote] = useState(initial.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
  const typedNote = shoppingItemNoteSchema.safeParse(note);

  return {
    name,
    note,
    /** The name the list already has, as its name key, after a refused add or rename. */
    duplicateKey,
    /** The note the person wrote, checked, to offer to the item already on the list. */
    noteForDuplicate: typedNote.success ? typedNote.data : null,
    /** A new name: any duplicate notice was about the old one. */
    changeName(value: string) {
      setName(value);
      setDuplicateKey(null);
    },
    changeNote: setNote,
    /** Fills both fields, as a suggestion does, or empties them for the next item. */
    fill(next: { name: string; note: string | null }) {
      setName(next.name);
      setNote(next.note ?? "");
      setDuplicateKey(null);
    },
    /** Both fields checked, showing what is wrong in each; null when something is. */
    parse(): { name: string; note: string | null } | null {
      setDuplicateKey(null);
      const parsedName = shoppingItemNameSchema.safeParse(name);
      const parsedNote = shoppingItemNoteSchema.safeParse(note);
      const fieldErrors: Partial<Record<Field, ErrorCode>> = {};
      if (!parsedName.success) fieldErrors.name = errorCodeFrom(parsedName.error);
      if (!parsedNote.success) fieldErrors.note = errorCodeFrom(parsedNote.error);
      setErrors(fieldErrors);
      if (!parsedName.success || !parsedNote.success) return null;
      return { name: parsedName.data, note: parsedNote.data };
    },
    /** Whether the server refused `sentName` because the list has it; if so, the notice shows. */
    refusedAsDuplicate(error: unknown, sentName: string): boolean {
      if (!(error instanceof ApiRequestError) || error.code !== "shopping.item.duplicate") return false;
      setDuplicateKey(shoppingNameKey(sentName));
      return true;
    },
    /** What is wrong with `field`, translated, or nothing. */
    fieldError(field: Field): string | undefined {
      const code = errors[field];
      return code ? t(code) : undefined;
    },
  };
}
