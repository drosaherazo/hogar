import { checkAdminInvariant, ROLES, type HouseholdView, type MemberView, type Role } from "@hogar/shared";
import { Alert, Avatar, Badge, Button, Card, Dialog, Menu, MenuItem, MenuRadioGroup, MenuSeparator } from "@hogar/ui";
import { LogOut, MoreHorizontal, UserMinus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { useBalances } from "../../expenses/useExpenses";
import { memberColor } from "../../household/members";
import { useChangeRole, useLeaveHousehold, useRemoveMember } from "../../household/useHousehold";
import { useMoney } from "../../i18n/format";
import styles from "./HouseholdSettingsPage.module.css";

/** Who lives here and with which role. Admins manage roles and people; everyone can leave. */
export function MembersSection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const changeRole = useChangeRole();
  const remove = useRemoveMember();
  const balances = useBalances();
  const money = useMoney();
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const isAdmin = household.myRole === "ADMIN";
  const error = changeRole.error ?? remove.error;

  // Removing someone with an open balance is allowed; the dialog says it stays in the balances.
  const removingBalance = removing
    ? (balances.data?.balances.find((entry) => entry.person.userId === removing.userId)?.balanceCents ?? 0)
    : 0;

  // The same rule the server enforces, used here only to explain what isn't possible.
  const meLeaving = checkAdminInvariant(household.members, { type: "leave", membershipId: household.myMembershipId });

  return (
    <Card as="section" padding="lg" aria-labelledby="settings-members" className={styles.section}>
      <h2 id="settings-members" className={styles.sectionTitle}>
        {t("settings.members.title")}
      </h2>
      {error && <Alert tone="danger">{t(errorKey(error))}</Alert>}
      <ul className={styles.list}>
        {household.members.map((member, index) => {
          const isMe = member.id === household.myMembershipId;
          const isOnlyAdmin =
            checkAdminInvariant(household.members, { type: "remove", membershipId: member.id }) === "last_admin";
          return (
            <li key={member.id} className={styles.listItem}>
              <div className={styles.person}>
                <Avatar name={member.name} src={member.avatarUrl} colorIndex={memberColor(index)} decorative />
                <span className={styles.itemTitle}>
                  {isMe ? t("settings.members.you", { name: member.name }) : member.name}
                  <Badge>{t(`roles.${member.role}`)}</Badge>
                </span>
              </div>
              {isAdmin && !isOnlyAdmin && (
                <Menu
                  trigger={
                    <Button variant="ghost" size="sm" aria-label={t("settings.members.options", { name: member.name })}>
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  }
                >
                  <MenuRadioGroup<Role>
                    label={t("settings.members.roleLabel")}
                    value={member.role}
                    onValueChange={(role) => {
                      remove.reset();
                      changeRole.mutate({ membershipId: member.id, role });
                    }}
                    options={ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
                  />
                  {!isMe && (
                    <>
                      <MenuSeparator />
                      <MenuItem icon={<UserMinus />} onSelect={() => setRemoving(member)}>
                        {t("settings.members.remove")}
                      </MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </li>
          );
        })}
      </ul>
      {meLeaving === "last_admin" && <p className={styles.muted}>{t("settings.members.onlyAdmin")}</p>}
      <LeaveButton
        household={household}
        disabled={meLeaving === "last_admin"}
        deletes={meLeaving === "deletes_household"}
      />

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("settings.members.removeTitle", { name: removing?.name ?? "" })}
        description={t("settings.members.removeDescription", { name: removing?.name ?? "" })}
        closeLabel={t("close")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t("cancel")}
            </Button>
            <Button
              loading={remove.isPending}
              loadingLabel={t("settings.members.removing")}
              onClick={() => {
                if (!removing) return;
                changeRole.reset();
                remove.mutate(removing.id, { onSettled: () => setRemoving(null) });
              }}
            >
              {t("settings.members.removeConfirm", { name: removing?.name ?? "" })}
            </Button>
          </>
        }
      >
        {removing && removingBalance !== 0 && (
          <p className={styles.moneyNote}>
            {removingBalance < 0
              ? t("settings.members.removeOwes", { name: removing.name, amount: money(-removingBalance) })
              : t("settings.members.removeOwed", { name: removing.name, amount: money(removingBalance) })}
          </p>
        )}
      </Dialog>
    </Card>
  );
}

function LeaveButton({
  household,
  disabled,
  deletes,
}: {
  household: HouseholdView;
  disabled: boolean;
  deletes: boolean;
}) {
  const { t } = useTranslation(["household", "errors"]);
  const leave = useLeaveHousehold();
  const balances = useBalances();
  const money = useMoney();
  const [confirming, setConfirming] = useState(false);
  const name = household.name;
  // Leaving with an open balance is allowed; it stays in the balances under the person's name.
  // When the last member leaves, everything is deleted, so there's no balance to mention.
  const myBalance = deletes ? 0 : (balances.data?.myBalanceCents ?? 0);

  return (
    <>
      <Button
        variant="secondary"
        icon={<LogOut />}
        className={styles.alignStart}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {t("settings.members.leave")}
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) leave.reset();
        }}
        title={t("settings.members.leaveTitle", { household: name })}
        description={
          deletes
            ? t("settings.members.leaveLastDescription", { household: name })
            : t("settings.members.leaveDescription")
        }
        closeLabel={t("close")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button
              loading={leave.isPending}
              loadingLabel={t("settings.members.leaving")}
              onClick={() => leave.mutate()}
            >
              {deletes ? t("settings.members.leaveDeleteConfirm") : t("settings.members.leaveConfirm")}
            </Button>
          </>
        }
      >
        {myBalance !== 0 && (
          <p className={styles.moneyNote}>
            {myBalance < 0
              ? t("settings.members.leaveOwes", { amount: money(-myBalance) })
              : t("settings.members.leaveOwed", { amount: money(myBalance) })}
          </p>
        )}
        {leave.isError && <Alert tone="danger">{t(errorKey(leave.error))}</Alert>}
      </Dialog>
    </>
  );
}
