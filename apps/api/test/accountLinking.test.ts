import { authResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ana, createTestApp, db, WEB_ORIGIN } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

function googleSignIn(app: App, credential: string) {
  return request(app).post("/api/auth/google").set("Origin", WEB_ORIGIN).send({ credential });
}

/** A person as a code sign-up creates them: an email, a starter name and no Google account. */
function createPersonWithoutGoogle(email = ana.email) {
  return db.user.create({ data: { email, name: "Nutria Valiente", locale: "es" } });
}

describe("one person per email address (Google sign-in)", () => {
  it("links Google to the person who already has that address, keeping their name and adding the photo", async () => {
    const { app, google } = createTestApp();
    const person = await createPersonWithoutGoogle();
    google.identities.set("ana-shouty", { ...ana, email: "  Ana@Example.COM ", locale: "en" });

    const res = await googleSignIn(app, "ana-shouty");

    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user).toEqual({
      id: person.id,
      email: ana.email,
      name: "Nutria Valiente",
      avatarUrl: ana.avatarUrl,
      locale: "es",
    });
    expect(await db.user.count()).toBe(1);
  });

  it("recognizes the linked person by their Google account from then on, even after Google's email changes", async () => {
    const { app, google } = createTestApp();
    const person = await createPersonWithoutGoogle();
    await googleSignIn(app, "valid-ana-token");

    google.identities.set("ana-moved", { ...ana, email: "ana.new@example.com" });
    const res = await googleSignIn(app, "ana-moved");

    expect(authResponseSchema.parse(res.body).user).toMatchObject({ id: person.id, email: ana.email });
    expect(await db.user.count()).toBe(1);
  });

  it("never collides with another person when a linked Google account changes to their address", async () => {
    const { app, google } = createTestApp();
    const first = authResponseSchema.parse((await googleSignIn(app, "valid-ana-token")).body);
    const other = await createPersonWithoutGoogle("ana.new@example.com");

    google.identities.set("ana-moved", { ...ana, email: "ana.new@example.com" });
    const res = await googleSignIn(app, "ana-moved");

    expect(authResponseSchema.parse(res.body).user).toMatchObject({ id: first.user.id, email: ana.email });
    expect(await db.user.findUniqueOrThrow({ where: { id: other.id } })).toEqual(other);
  });

  it("refuses a second Google account for an address that already signs in with Google, changing nothing", async () => {
    const { app, google } = createTestApp();
    await googleSignIn(app, "valid-ana-token");
    const before = await db.user.findMany();
    google.identities.set("other-google", {
      ...ana,
      googleId: "google-ana-second-account",
      name: "Someone Else",
      avatarUrl: "https://lh3.googleusercontent.com/a/other",
    });

    const res = await googleSignIn(app, "other-google");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "auth.google.already_linked" } });
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(await db.user.findMany()).toEqual(before);
  });
});
