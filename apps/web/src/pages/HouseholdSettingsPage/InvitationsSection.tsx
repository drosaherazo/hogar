import type { InvitableRole, InvitationView } from "@hogar/shared";
import { Alert, Badge, Button, Card, Dialog, Spinner } from "@hogar/ui";
import { RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { formatTimeLeft } from "../../household/timeLeft";
import {
  useCreateInvitation,
  useInvitations,
  useRenewInvitation,
  useRevokeInvitation,
} from "../../household/useHousehold";
import styles from "./HouseholdSettingsPage.module.css";
import { InvitationLink } from "./InvitationLink";

const INVITABLE_ROLES: InvitableRole[] = ["MEMBER", "GUEST"];

/** Admin-only: create links, see pending ones, replace lost ones and revoke them. */
export function InvitationsSection() {
  const { t } = useTranslation(["household", "common", "errors"]);
  const invitations = useInvitations(true);
  const [creating, setCreating] = useState(false);
  const [shownToken, setShownToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<InvitationView | null>(null);
  const renew = useRenewInvitation();

  return (
    <Card as="section" padding="lg" aria-labelledby="settings-invitations" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id="settings-invitations" className={styles.sectionTitle}>
          {t("settings.invitations.title")}
        </h2>
        <Button icon={<UserPlus />} onClick={() => setCreating(true)}>
          {t("settings.invitations.create")}
        </Button>
      </div>
      <p className={styles.muted}>{t("settings.invitations.description")}</p>

      {renew.isError && <Alert tone="danger">{t(errorKey(renew.error))}</Alert>}
      {invitations.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : invitations.isError ? (
        <Alert tone="danger">{t(errorKey(invitations.error))}</Alert>
      ) : invitations.data.length === 0 ? (
        <p className={styles.muted}>{t("settings.invitations.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {invitations.data.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              renewing={renew.isPending && renew.variables === invitation.id}
              onRenew={() => renew.mutate(invitation.id, { onSuccess: ({ token }) => setShownToken(token) })}
              onRevoke={() => setRevoking(invitation)}
            />
          ))}
        </ul>
      )}

      <CreateInvitationDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(token) => {
          setCreating(false);
          setShownToken(token);
        }}
      />
      <Dialog
        open={shownToken !== null}
        onOpenChange={(open) => !open && setShownToken(null)}
        title={t("settings.invitations.linkTitle")}
        description={t("settings.invitations.linkDescription")}
        closeLabel={t("close")}
        actions={<Button onClick={() => setShownToken(null)}>{t("settings.invitations.done")}</Button>}
      >
        {shownToken && <InvitationLink token={shownToken} />}
      </Dialog>
      <RevokeDialog invitation={revoking} onClose={() => setRevoking(null)} />
    </Card>
  );
}

function InvitationRow({
  invitation,
  renewing,
  onRenew,
  onRevoke,
}: {
  invitation: InvitationView;
  renewing: boolean;
  onRenew: () => void;
  onRevoke: () => void;
}) {
  const { t, i18n } = useTranslation("household");
  const expired = invitation.status === "expired";

  return (
    <li className={styles.listItem}>
      <div className={styles.itemText}>
        <span className={styles.itemTitle}>
          <Badge>{t(`roles.${invitation.role}`)}</Badge>
          {expired ? (
            <Badge tone="warning">{t("settings.invitations.expired")}</Badge>
          ) : (
            <span>
              {t("settings.invitations.expiresIn", {
                time: formatTimeLeft(invitation.expiresAt, i18n.resolvedLanguage ?? "en"),
              })}
            </span>
          )}
        </span>
        {invitation.createdByName && (
          <span className={styles.itemMeta}>
            {t("settings.invitations.createdBy", { name: invitation.createdByName })}
          </span>
        )}
      </div>
      <div className={styles.itemActions}>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw />}
          loading={renewing}
          loadingLabel={t("settings.invitations.renewing")}
          onClick={onRenew}
        >
          {t("settings.invitations.renew")}
        </Button>
        <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={onRevoke}>
          {t("settings.invitations.revoke")}
        </Button>
      </div>
    </li>
  );
}

function CreateInvitationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: string) => void;
}) {
  const { t } = useTranslation(["household", "errors"]);
  const formId = useId();
  const create = useCreateInvitation();
  const [role, setRole] = useState<InvitableRole>("MEMBER");

  function changeOpen(next: boolean) {
    if (!next) {
      setRole("MEMBER");
      create.reset();
    }
    onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(role, { onSuccess: ({ token }) => onCreated(token) });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title={t("settings.invitations.createTitle")}
      description={t("settings.invitations.description")}
      closeLabel={t("close")}
      actions={
        <>
          <Button variant="secondary" onClick={() => changeOpen(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={create.isPending}
            loadingLabel={t("settings.invitations.creating")}
          >
            {t("settings.invitations.createSubmit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t("settings.invitations.roleLegend")}</legend>
          {INVITABLE_ROLES.map((option) => (
            <label key={option} className={styles.choice}>
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className={styles.radio}
              />
              <span className={styles.choiceText}>
                <span className={styles.itemTitle}>{t(`roles.${option}`)}</span>
                <span className={styles.itemMeta}>{t(`settings.invitations.roleHint.${option}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </form>
      {create.isError && <Alert tone="danger">{t(errorKey(create.error))}</Alert>}
    </Dialog>
  );
}

function RevokeDialog({ invitation, onClose }: { invitation: InvitationView | null; onClose: () => void }) {
  const { t } = useTranslation(["household", "errors"]);
  const revoke = useRevokeInvitation();

  return (
    <Dialog
      open={invitation !== null}
      onOpenChange={(open) => {
        if (!open) {
          revoke.reset();
          onClose();
        }
      }}
      title={t("settings.invitations.revokeTitle")}
      description={t("settings.invitations.revokeDescription")}
      closeLabel={t("close")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            loading={revoke.isPending}
            loadingLabel={t("settings.invitations.revoking")}
            onClick={() => invitation && revoke.mutate(invitation.id, { onSuccess: onClose })}
          >
            {t("settings.invitations.revokeConfirm")}
          </Button>
        </>
      }
    >
      {revoke.isError && <Alert tone="danger">{t(errorKey(revoke.error))}</Alert>}
    </Dialog>
  );
}
