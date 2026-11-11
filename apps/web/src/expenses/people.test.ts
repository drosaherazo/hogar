import type { MemberView, PersonRef } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { avatarPropsFor } from "./people";

const member = (userId: string, name: string): MemberView => ({
  id: `m-${userId}`,
  userId,
  name,
  avatarUrl: null,
  role: "MEMBER",
  weight: 1,
  shareBps: 5000,
  joinedAt: "2026-10-26T10:00:00.000Z",
});

const members = [member("ana", "Ana García"), member("bruno", "Bruno Díaz")];
const person = (userId: string, name: string, former = false): PersonRef => ({
  userId,
  name,
  avatarUrl: null,
  former,
});

describe("avatarPropsFor", () => {
  it("uses the member color by join order", () => {
    expect(avatarPropsFor(person("bruno", "Bruno Díaz"), members)).toEqual({
      name: "Bruno Díaz",
      src: null,
      colorIndex: 2,
    });
  });

  it("mutes people who are no longer members", () => {
    expect(avatarPropsFor(person("carla", "Carla Ruiz", true), members)).toEqual({
      name: "Carla Ruiz",
      src: null,
      muted: true,
    });
  });
});
