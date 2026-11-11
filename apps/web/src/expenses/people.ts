import type { MemberView, PersonRef } from "@hogar/shared";
import type { AvatarProps } from "@hogar/ui";
import { memberColor } from "../household/members";

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
