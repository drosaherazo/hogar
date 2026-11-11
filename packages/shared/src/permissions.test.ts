import { describe, expect, it } from "vitest";
import type { Role } from "./household";
import { canManageHousehold, checkAdminInvariant } from "./permissions";

const members = (...roles: Role[]) => roles.map((role, index) => ({ id: `m${index + 1}`, role }));

describe("checkAdminInvariant", () => {
  it("refuses to let the only admin leave while others remain", () => {
    expect(checkAdminInvariant(members("ADMIN", "MEMBER"), { type: "leave", membershipId: "m1" })).toBe("last_admin");
  });

  it("deletes the household when its only member leaves", () => {
    expect(checkAdminInvariant(members("ADMIN"), { type: "leave", membershipId: "m1" })).toBe("deletes_household");
  });

  it("lets anyone who isn't the last admin leave", () => {
    expect(checkAdminInvariant(members("ADMIN", "MEMBER"), { type: "leave", membershipId: "m2" })).toBe("ok");
    expect(checkAdminInvariant(members("ADMIN", "ADMIN"), { type: "leave", membershipId: "m1" })).toBe("ok");
  });

  it("refuses to remove or demote the last admin", () => {
    const household = members("ADMIN", "GUEST");
    expect(checkAdminInvariant(household, { type: "remove", membershipId: "m1" })).toBe("last_admin");
    expect(checkAdminInvariant(household, { type: "role", membershipId: "m1", role: "MEMBER" })).toBe("last_admin");
    expect(checkAdminInvariant(household, { type: "role", membershipId: "m1", role: "GUEST" })).toBe("last_admin");
  });

  it("lets one of two admins remove or demote the other", () => {
    const household = members("ADMIN", "ADMIN", "MEMBER");
    expect(checkAdminInvariant(household, { type: "remove", membershipId: "m2" })).toBe("ok");
    expect(checkAdminInvariant(household, { type: "role", membershipId: "m2", role: "MEMBER" })).toBe("ok");
  });

  it("allows any change to members and guests", () => {
    const household = members("ADMIN", "MEMBER", "GUEST");
    expect(checkAdminInvariant(household, { type: "role", membershipId: "m2", role: "GUEST" })).toBe("ok");
    expect(checkAdminInvariant(household, { type: "role", membershipId: "m3", role: "ADMIN" })).toBe("ok");
    expect(checkAdminInvariant(household, { type: "remove", membershipId: "m3" })).toBe("ok");
  });

  it("treats keeping the admin role as a no-op", () => {
    expect(checkAdminInvariant(members("ADMIN"), { type: "role", membershipId: "m1", role: "ADMIN" })).toBe("ok");
  });
});

describe("canManageHousehold", () => {
  it("is true only for admins", () => {
    expect(canManageHousehold("ADMIN")).toBe(true);
    expect(canManageHousehold("MEMBER")).toBe(false);
    expect(canManageHousehold("GUEST")).toBe(false);
  });
});
