import type { MemberColorIndex } from "@hogar/ui";

/**
 * Member colors are assigned by join order and never change between screens.
 * `index` is the position in the household's member list, which the API already sorts by join date.
 */
export function memberColor(index: number): MemberColorIndex {
  return ((index % 8) + 1) as MemberColorIndex;
}
