import { authResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAccessTokenSigner, hashRefreshToken } from "../src/auth/tokens";
import { ana, config, createTestApp, db, WEB_ORIGIN } from "./testApp";

const DAY_MS = 24 * 60 * 60 * 1000;

function refreshCookieFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((value) => value.startsWith("hogar_refresh="));
  if (!cookie) throw new Error("No refresh cookie in response");
  return cookie;
}

function cookieValue(setCookie: string): string {
  return setCookie.split(";")[0]?.split("=")[1] ?? "";
}

async function login(app: ReturnType<typeof createTestApp>["app"], credential = "valid-ana-token") {
  const res = await request(app).post("/api/auth/google").set("Origin", WEB_ORIGIN).send({ credential });
  return { res, cookie: refreshCookieFrom(res) };
}

function refresh(app: ReturnType<typeof createTestApp>["app"], token: string) {
  return request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("Cookie", `hogar_refresh=${token}`);
}

describe("POST /api/auth/google", () => {
  it("creates the user on first login and returns a token with their basic info", async () => {
    const { app } = createTestApp();
    const { res } = await login(app);

    expect(res.status).toBe(200);
    const body = authResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: ana.email, name: ana.name, avatarUrl: ana.avatarUrl, locale: "es" });

    const claims = await createAccessTokenSigner(config.jwtAccessSecret, 900).verify(body.accessToken);
    expect(claims).toEqual({
      sub: body.user.id,
      email: ana.email,
      name: ana.name,
      picture: ana.avatarUrl,
      locale: "es",
    });
    expect(await db.user.count()).toBe(1);
  });

  it("sets an httpOnly, secure, SameSite=Lax refresh cookie scoped to /api/auth", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it("stores only the hash of the refresh token", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    const token = cookieValue(cookie);
    const stored = await db.refreshToken.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(hashRefreshToken(token));
    expect(stored[0]?.tokenHash).not.toBe(token);
  });

  it("updates name and photo on later logins but keeps the same user and their chosen locale", async () => {
    const { app, google } = createTestApp();
    const first = authResponseSchema.parse((await login(app)).res.body);
    await db.user.update({ where: { id: first.user.id }, data: { locale: "en" } });

    google.identities.set("new-ana-token", { ...ana, name: "Ana G.", avatarUrl: null, locale: "es" });
    const second = authResponseSchema.parse((await login(app, "new-ana-token")).res.body);

    expect(second.user).toMatchObject({ id: first.user.id, name: "Ana G.", avatarUrl: null, locale: "en" });
    expect(await db.user.count()).toBe(1);
  });

  it("guesses the locale from Accept-Language when Google doesn't send one", async () => {
    const { app, google } = createTestApp();
    google.identities.set("no-locale", { ...ana, locale: null });
    const res = await request(app)
      .post("/api/auth/google")
      .set("Origin", WEB_ORIGIN)
      .set("Accept-Language", "es-ES,es;q=0.9")
      .send({ credential: "no-locale" });
    expect(authResponseSchema.parse(res.body).user.locale).toBe("es");
  });

  it("rejects an invalid Google token", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/auth/google").set("Origin", WEB_ORIGIN).send({ credential: "forged" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.google.invalid_token" } });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects Google accounts with an unverified email", async () => {
    const { app, google } = createTestApp();
    google.identities.set("unverified", { ...ana, emailVerified: false });
    const res = await request(app)
      .post("/api/auth/google")
      .set("Origin", WEB_ORIGIN)
      .send({ credential: "unverified" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.google.email_not_verified" } });
    expect(await db.user.count()).toBe(0);
  });

  it.each([{}, { credential: "" }, { credential: 42 }])("rejects an invalid body %j", async (body) => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/auth/google").set("Origin", WEB_ORIGIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });

  it("rejects malformed JSON", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/api/auth/google")
      .set("Origin", WEB_ORIGIN)
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });

  it.each([undefined, "https://evil.example"])("rejects requests from origin %s", async (origin) => {
    const { app } = createTestApp();
    const req = request(app).post("/api/auth/google");
    if (origin) req.set("Origin", origin);
    const res = await req.send({ credential: "valid-ana-token" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "request.forbidden_origin" } });
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns a new access token and rotates the refresh token", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    const res = await refresh(app, cookieValue(cookie));

    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.email).toBe(ana.email);
    const rotated = cookieValue(refreshCookieFrom(res));
    expect(rotated).not.toBe(cookieValue(cookie));

    const old = await db.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(cookieValue(cookie)) },
    });
    const next = await db.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(rotated) } });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedById).toBe(next.id);
    expect(next.familyId).toBe(old.familyId);
  });

  it("treats reuse right after rotation as a harmless race (two tabs) and keeps the session", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    const rotated = cookieValue(refreshCookieFrom(await refresh(app, cookieValue(cookie))));

    const again = await refresh(app, cookieValue(cookie));
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: { code: "auth.session.missing" } });
    expect((await refresh(app, rotated)).status).toBe(200);
  });

  it("revokes the whole session when a rotated token is reused later (possible theft)", async () => {
    const { app, clock } = createTestApp();
    const { cookie } = await login(app);
    const rotated = cookieValue(refreshCookieFrom(await refresh(app, cookieValue(cookie))));

    clock.advance(60_000);
    const stolen = await refresh(app, cookieValue(cookie));
    expect(stolen.status).toBe(401);
    expect(stolen.body).toEqual({ error: { code: "auth.session.reused" } });

    const legit = await refresh(app, rotated);
    expect(legit.status).toBe(401);
    expect(await db.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("rejects an expired refresh token", async () => {
    const { app, clock } = createTestApp();
    const { cookie } = await login(app);
    clock.advance(31 * DAY_MS);
    const res = await refresh(app, cookieValue(cookie));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.session.expired" } });
  });

  it("rejects a missing or unknown cookie and clears it", async () => {
    const { app } = createTestApp();
    const missing = await request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN);
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: { code: "auth.session.missing" } });

    const unknown = await refresh(app, "unknown-token");
    expect(unknown.status).toBe(401);
    expect(refreshCookieFrom(unknown)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("rejects requests from another origin", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "https://evil.example")
      .set("Cookie", `hogar_refresh=${cookieValue(cookie)}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const { app } = createTestApp();
    const { cookie } = await login(app);
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", `hogar_refresh=${cookieValue(cookie)}`);

    expect(res.status).toBe(204);
    expect(refreshCookieFrom(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await refresh(app, cookieValue(cookie))).status).toBe(401);
  });

  it("succeeds even without a session", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/auth/logout").set("Origin", WEB_ORIGIN);
    expect(res.status).toBe(204);
  });
});
