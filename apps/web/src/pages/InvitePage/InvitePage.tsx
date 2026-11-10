import type { InvitationPreview } from "@hogar/shared";
import { Alert, Button, Card, Dialog, Spinner } from "@hogar/ui";
import { useQuery } from "@tanstack/react-query";
import { House, LogOut } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { useApiClient } from "../../api/ApiClientContext";
import { ApiRequestError, errorKey } from "../../api/client";
import { useAcceptInvitation, useLeaveHousehold } from "../../household/useHousehold";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./InvitePage.module.css";

/** Invitation problems are final (used, expired…): asking again won't change the answer. */
const isFinal = (error: unknown) => error instanceof ApiRequestError && error.status >= 400 && error.status < 500;

/**
 * Where an invitation link lands (`/invite#<token>`). The token lives in the URL fragment,
 * which browsers never send to servers, and nothing happens until the person chooses "Join".
 */
export function InvitePage() {
  const { t } = useTranslation(["household", "common"]);
  const client = useApiClient();
  const token = decodeURIComponent(useLocation().hash.slice(1));

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () =>
      token ? client.lookupInvitation(token) : Promise.reject(new ApiRequestError("invitation.not_found", 404)),
    retry: (failures, error) => !isFinal(error) && failures < 1,
  });

  return (
    <AppShell>
      {preview.isPending ? (
        // No title yet: it would read "You've been invited" and then flip if the link turns out unusable.
        <Spinner label={t("common:loading")} />
      ) : (
        <Card as="section" padding="lg" aria-labelledby="invite-title" className={styles.card}>
          <h1 id="invite-title" className={styles.title}>
            {preview.isError ? t("invite.problemTitle") : t("invite.title")}
          </h1>
          {preview.isError ? (
            <Problem error={preview.error} />
          ) : (
            <Invitation token={token} preview={preview.data} onLeft={() => void preview.refetch()} />
          )}
        </Card>
      )}
    </AppShell>
  );
}

function Problem({ error }: { error: unknown }) {
  const { t } = useTranslation(["household", "errors"]);
  return (
    <>
      <Alert tone={isFinal(error) ? "info" : "danger"}>{t(errorKey(error))}</Alert>
      <ActionLink to="/" icon={<House />} className={styles.action}>
        {t("invite.backHome")}
      </ActionLink>
    </>
  );
}

function Invitation({ token, preview, onLeft }: { token: string; preview: InvitationPreview; onLeft: () => void }) {
  const { t } = useTranslation(["household", "errors"]);
  const navigate = useNavigate();
  const accept = useAcceptInvitation();
  const household = preview.householdName;
  const role = t(`invite.role.${preview.role}`);

  if (preview.viewer === "already_member") {
    return (
      <>
        <p className={styles.text}>{t("invite.alreadyMember", { household })}</p>
        <ActionLink to="/" icon={<House />} className={styles.action}>
          {t("invite.goHome")}
        </ActionLink>
      </>
    );
  }

  return (
    <>
      <p className={styles.text}>
        {preview.inviterName
          ? t("invite.description", { inviter: preview.inviterName, household, role })
          : t("invite.descriptionNoInviter", { household, role })}
      </p>
      {preview.viewer === "has_other_household" ? (
        <LeaveFirst household={household} onLeft={onLeft} />
      ) : (
        <>
          {accept.isError && <Alert tone="danger">{t(errorKey(accept.error))}</Alert>}
          <Button
            className={styles.action}
            loading={accept.isPending}
            loadingLabel={t("invite.joining")}
            onClick={() => accept.mutate(token, { onSuccess: () => void navigate("/", { replace: true }) })}
          >
            {t("invite.join", { household })}
          </Button>
        </>
      )}
    </>
  );
}

function LeaveFirst({ household, onLeft }: { household: string; onLeft: () => void }) {
  const { t } = useTranslation(["household", "errors"]);
  const leave = useLeaveHousehold();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Alert tone="warning">{t("invite.otherHousehold", { household })}</Alert>
      <Button variant="secondary" icon={<LogOut />} className={styles.action} onClick={() => setConfirming(true)}>
        {t("invite.leave")}
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) leave.reset();
        }}
        title={t("invite.leaveTitle")}
        description={t("invite.leaveDescription")}
        closeLabel={t("close")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button
              loading={leave.isPending}
              loadingLabel={t("invite.leaving")}
              onClick={() =>
                leave.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false);
                    onLeft();
                  },
                })
              }
            >
              {t("invite.leaveConfirm")}
            </Button>
          </>
        }
      >
        {leave.isError && <Alert tone="danger">{t(errorKey(leave.error))}</Alert>}
      </Dialog>
    </>
  );
}
