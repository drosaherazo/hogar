import type { MemberView, PersonRef } from "@hogar/shared";
import type { AvatarProps } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import { memberColor } from "../household/members";

/**
 * A person's name for lists and fields, saying in words when they're no longer a member
 * ("Carla Ruiz (former member)"), so it never relies on a muted look alone.
 */
export function usePersonLabel() {
  const { t } = useTranslation("expenses");
  return (person: PersonRef) => (person.former ? t("balances.formerName", { name: person.name }) : person.name);
}

/**
 * Avatar props for someone in the money history: their member color while they are a member
 * (by join order, as everywhere else), or the muted look once they've left.
 */
export function avatarPropsFor(
  person: PersonRef,
  members: readonly MemberView[],
): Pick<AvatarProps, "name" | "src" | "colorIndex" | "muted"> {
  const index = members.findIndex((member) => member.userId === person.userId);
  if (person.former || index < 0) return { name: person.name, src: person.avatarUrl, muted: true };
  return { name: person.name, src: person.avatarUrl, colorIndex: memberColor(index) };
}
