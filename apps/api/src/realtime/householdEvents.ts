import type { HouseholdEvent } from "@hogar/shared";

/**
 * How services tell a household's members, live, that something changed. Call it only after the
 * transaction commits: an event that arrives before the change is visible would make clients
 * re-read the old data and miss the new one.
 */
export interface HouseholdEvents {
  publish(householdId: string, event: HouseholdEvent): void;
  /**
   * `userId` is no longer a member of the household: their sockets leave its room at once, and
   * their other screens are told to re-read, so access ends when membership ends.
   */
  membershipEnded(householdId: string, userId: string): void;
}

/** The default: the API also works, and every service can be tested, without real time. */
export const noHouseholdEvents: HouseholdEvents = {
  publish: () => undefined,
  membershipEnded: () => undefined,
};
