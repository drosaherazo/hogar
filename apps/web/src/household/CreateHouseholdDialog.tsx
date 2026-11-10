import { errorCodeFrom, householdNameSchema } from "@hogar/shared";
import { Button, Dialog, TextField } from "@hogar/ui";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";
import { useCreateHousehold } from "./useHousehold";

export interface CreateHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Asks only for a name: the creator becomes the household's admin. */
export function CreateHouseholdDialog({ open, onOpenChange }: CreateHouseholdDialogProps) {
  const { t } = useTranslation(["household", "errors"]);
  const formId = useId();
  const create = useCreateHousehold();
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string>();

  function changeOpen(next: boolean) {
    if (!next) {
      setName("");
      setFieldError(undefined);
      create.reset();
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Same schema as the API, so the person hears about a problem before any request.
    const parsed = householdNameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(t(`errors:${errorCodeFrom(parsed.error)}`));
      return;
    }
    setFieldError(undefined);
    create.mutate(parsed.data, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title={t("create.title")}
      description={t("create.description")}
      closeLabel={t("close")}
      actions={
        <>
          <Button variant="secondary" onClick={() => changeOpen(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending} loadingLabel={t("create.submitting")}>
            {t("create.submit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <TextField
          label={t("create.nameLabel")}
          hint={t("create.nameHint")}
          error={fieldError ?? (create.isError ? t(errorKey(create.error)) : undefined)}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </form>
    </Dialog>
  );
}
