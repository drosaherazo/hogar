import { describe, expect, it } from "vitest";
import { errorCodeFrom } from "./errors";
import {
  createHouseholdRequestSchema,
  createInvitationRequestSchema,
  householdNameSchema,
  invitationTokenRequestSchema,
  updateSplitRequestSchema,
  weightSchema,
} from "./household";

describe("householdNameSchema", () => {
  it("trims the name and accepts 1 to 50 characters", () => {
    expect(householdNameSchema.parse("  Casa Ana  ")).toBe("Casa Ana");
    expect(householdNameSchema.safeParse("a".repeat(50)).success).toBe(true);
  });

  it("returns error codes, not sentences", () => {
    expect(errorCodeFrom(householdNameSchema.safeParse("").error)).toBe("household.name.required");
    expect(errorCodeFrom(householdNameSchema.safeParse("    ").error)).toBe("household.name.required");
    expect(errorCodeFrom(householdNameSchema.safeParse("a".repeat(51)).error)).toBe("household.name.too_long");
  });

  it("is what the create request validates", () => {
    expect(createHouseholdRequestSchema.safeParse({ name: "Piso Lavapiés" }).success).toBe(true);
    expect(createHouseholdRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("createInvitationRequestSchema", () => {
  it("only invites members and guests, never admins", () => {
    expect(createInvitationRequestSchema.safeParse({ role: "MEMBER" }).success).toBe(true);
    expect(createInvitationRequestSchema.safeParse({ role: "GUEST" }).success).toBe(true);
    expect(createInvitationRequestSchema.safeParse({ role: "ADMIN" }).success).toBe(false);
  });
});

describe("invitationTokenRequestSchema", () => {
  it("requires a non-empty token", () => {
    expect(invitationTokenRequestSchema.safeParse({ token: "abc" }).success).toBe(true);
    expect(invitationTokenRequestSchema.safeParse({ token: "" }).success).toBe(false);
  });
});

describe("weightSchema", () => {
  it("accepts whole numbers from 0 to 100", () => {
    for (const weight of [0, 1, 3, 100]) expect(weightSchema.safeParse(weight).success).toBe(true);
  });

  it("rejects anything else with split.weight.invalid", () => {
    for (const weight of [-1, 101, 1.5, Number.NaN]) {
      expect(errorCodeFrom(weightSchema.safeParse(weight).error)).toBe("split.weight.invalid");
    }
  });
});

describe("updateSplitRequestSchema", () => {
  it("accepts weights with at least one above zero", () => {
    const body = {
      weights: [
        { membershipId: "m1", weight: 3 },
        { membershipId: "m2", weight: 0 },
      ],
    };
    expect(updateSplitRequestSchema.safeParse(body).success).toBe(true);
  });

  it("rejects a split where every weight is zero", () => {
    const body = {
      weights: [
        { membershipId: "m1", weight: 0 },
        { membershipId: "m2", weight: 0 },
      ],
    };
    expect(errorCodeFrom(updateSplitRequestSchema.safeParse(body).error)).toBe("split.all_zero");
  });

  it("rejects the same member twice", () => {
    const body = {
      weights: [
        { membershipId: "m1", weight: 1 },
        { membershipId: "m1", weight: 2 },
      ],
    };
    expect(errorCodeFrom(updateSplitRequestSchema.safeParse(body).error)).toBe("split.members_changed");
  });
});

describe("errorCodeFrom", () => {
  it("falls back to request.invalid for issues without a code", () => {
    expect(errorCodeFrom(createHouseholdRequestSchema.safeParse({ name: 42 }).error)).toBe("request.invalid");
    expect(errorCodeFrom(undefined)).toBe("request.invalid");
  });
});
