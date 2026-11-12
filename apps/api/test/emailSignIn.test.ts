import { authResponseSchema, STARTER_ADJECTIVES, STARTER_ANIMALS } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ana, createTestApp, db, signIn, WEB_ORIGIN, type RecordingMailer } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function requestCode(app: App, email: string, locale = "en") {
  return request(app).post("/api/auth/email/code").set("Origin", WEB_ORIGIN).send({ email, locale });
}

function signInWithCode(app: App, email: string, code: string) {
  return request(app).post("/api/auth/email/sign-in").set("Origin", WEB_ORIGIN).send({ email, code });
}

/** Reads the code from the last email sent to `email`, as a person reads their inbox. */
function codeFrom(mailer: RecordingMailer, email: string): string {
  const code = /\b(\d{6})\b/.exec(mailer.lastTo(email).text)?.[1];
  if (!code) throw new Error("No code in the email");
  return code;
}

/** A 6-digit code that is not `code`. */
const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

function refreshCookieFrom(res: request.Response): string {
  const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("hogar_refresh="));
  if (!cookie) throw new Error("No refresh cookie in response");
  return cookie.split(";")[0] ?? "";
}

describe("signing in with a code", () => {
  it("signs up a new address: a starter name in the login page's language, and a session like Google's", async () => {
    const { app, mailer } = createTestApp();

    const sent = await requestCode(app, "lucia@example.com", "es");
    expect(sent.status).toBe(204);

    const res = await signInWithCode(app, "lucia@example.com", codeFrom(mailer, "lucia@example.com"));
    expect(res.status).toBe(200);
    expect(refreshCookieFrom(res)).toMatch(/^hogar_refresh=.+/);
    const { user } = authResponseSchema.parse(res.body);
    expect(user).toMatchObject({ email: "lucia@example.com", avatarUrl: null, locale: "es" });
    const [animal, adjective] = user.name.split(" ");
    expect(STARTER_ANIMALS.map((a) => a.es)).toContain(animal);
    expect(STARTER_ADJECTIVES.map((a) => a.es)).toContain(adjective);
  });

  it("signs in someone who signed up with Google, into their own place, with their own language", async () => {
    const { app, mailer } = createTestApp();
    const google = await signIn(app, ana);

    await requestCode(app, ana.email, "en");
    expect(mailer.lastTo(ana.email).subject).toMatch(/es tu código de Hogar$/);
    const res = await signInWithCode(app, ana.email, codeFrom(mailer, ana.email));

    expect(authResponseSchema.parse(res.body).user).toEqual(google.user);
    expect(await db.user.count()).toBe(1);
  });

  it("sends a new person's email in the login page's language, with a plain-text part and no links", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com", "es");
    const email = mailer.lastTo("lucia@example.com");
    expect(email.subject).toMatch(/^\d{6} es tu código de Hogar$/);
    expect(email.text).toMatch(/10 minutos/);
    expect(email.html).not.toMatch(/<a[\s>]|https?:\/\//i);
  });

  it("answers exactly the same whether or not someone uses that address", async () => {
    const { app } = createTestApp();
    await signIn(app, ana);
    const known = await requestCode(app, ana.email);
    const unknown = await requestCode(app, "nobody@example.com");
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(unknown.headers["set-cookie"]).toEqual(known.headers["set-cookie"]);
  });

  it("treats capitals and stray spaces as the same address, and + addresses as their own", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "  Lucia@Example.COM ");
    const first = authResponseSchema.parse(
      (await signInWithCode(app, "lucia@example.com", codeFrom(mailer, "lucia@example.com"))).body,
    );

    await requestCode(app, "lucia+hogar@example.com");
    const plus = authResponseSchema.parse(
      (await signInWithCode(app, "LUCIA+hogar@example.com ", codeFrom(mailer, "lucia+hogar@example.com"))).body,
    );

    expect(first.user.email).toBe("lucia@example.com");
    expect(plus.user.email).toBe("lucia+hogar@example.com");
    expect(plus.user.id).not.toBe(first.user.id);
  });

  it("accepts a code typed with spaces", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");
    const res = await signInWithCode(app, "lucia@example.com", `${code.slice(0, 3)} ${code.slice(3)}`);
    expect(res.status).toBe(200);
  });

  it("lets a code in only once, even when it is sent twice at the same moment, creating one person", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");

    const results = await Promise.all([
      signInWithCode(app, "lucia@example.com", code),
      signInWithCode(app, "lucia@example.com", code),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(results.find((r) => r.status === 401)?.body).toEqual({ error: { code: "auth.code.expired" } });
    expect(await db.user.count()).toBe(1);
  });

  it("refreshes and logs out a code session like a Google one", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const cookie = refreshCookieFrom(
      await signInWithCode(app, "lucia@example.com", codeFrom(mailer, "lucia@example.com")),
    );

    const refreshed = await request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("Cookie", cookie);
    expect(refreshed.status).toBe(200);
    expect(authResponseSchema.parse(refreshed.body).user.email).toBe("lucia@example.com");

    const next = refreshCookieFrom(refreshed);
    const out = await request(app).post("/api/auth/logout").set("Origin", WEB_ORIGIN).set("Cookie", next);
    expect(out.status).toBe(204);
    const after = await request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("Cookie", next);
    expect(after.status).toBe(401);
  });

  it.each([
    ["/api/auth/email/code", { email: "not-an-email", locale: "en" }, "auth.email.invalid"],
    ["/api/auth/email/code", { email: "lucia@example.com", locale: "fr" }, "request.invalid"],
    ["/api/auth/email/sign-in", { email: "lucia@example.com", code: "12345" }, "auth.code.format"],
    ["/api/auth/email/sign-in", { email: "nope", code: "123456" }, "auth.email.invalid"],
  ])("rejects a malformed body on %s with 400 %j", async (path, body, code) => {
    const { app, mailer } = createTestApp();
    const res = await request(app).post(path).set("Origin", WEB_ORIGIN).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect(mailer.sent).toHaveLength(0);
  });

  it("rejects requests from another origin", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post("/api/auth/email/code")
      .set("Origin", "https://evil.example")
      .send({ email: "lucia@example.com", locale: "en" });
    expect(res.status).toBe(403);
  });
});

describe("sign-in code protections", () => {
  it("stops working after 10 minutes", async () => {
    const { app, mailer, clock } = createTestApp();
    await requestCode(app, "lucia@example.com");
    clock.advance(10 * MINUTE_MS);
    const res = await signInWithCode(app, "lucia@example.com", codeFrom(mailer, "lucia@example.com"));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.code.expired" } });
  });

  it("still works just before 10 minutes", async () => {
    const { app, mailer, clock } = createTestApp();
    await requestCode(app, "lucia@example.com");
    clock.advance(10 * MINUTE_MS - 1000);
    expect((await signInWithCode(app, "lucia@example.com", codeFrom(mailer, "lucia@example.com"))).status).toBe(200);
  });

  it("works only once", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");
    await signInWithCode(app, "lucia@example.com", code);
    const again = await signInWithCode(app, "lucia@example.com", code);
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: { code: "auth.code.expired" } });
  });

  it("is replaced by a newer code", async () => {
    const { app, mailer, clock } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const old = codeFrom(mailer, "lucia@example.com");
    clock.advance(MINUTE_MS);
    await requestCode(app, "lucia@example.com");
    const fresh = codeFrom(mailer, "lucia@example.com");

    const res = await signInWithCode(app, "lucia@example.com", old);
    if (old !== fresh) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: { code: "auth.code.expired" } });
    }
    expect((await signInWithCode(app, "lucia@example.com", fresh)).status).toBe(200);
  });

  it("explains a wrong code kindly while attempts are left", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");
    const res = await signInWithCode(app, "lucia@example.com", wrongCode(code));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.code.wrong" } });
    expect((await signInWithCode(app, "lucia@example.com", code)).status).toBe(200);
  });

  it("dies after 5 wrong attempts, even if the right code comes next", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");

    const codes: string[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      codes.push((await signInWithCode(app, "lucia@example.com", wrongCode(code))).body.error.code);
    }
    expect(codes).toEqual([
      "auth.code.wrong",
      "auth.code.wrong",
      "auth.code.wrong",
      "auth.code.wrong",
      "auth.code.expired",
    ]);
    expect((await signInWithCode(app, "lucia@example.com", code)).body).toEqual({
      error: { code: "auth.code.expired" },
    });
  });

  it("never allows more than 5 guesses, even when they arrive in parallel", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");

    const guesses = await Promise.all(
      Array.from({ length: 12 }, () => signInWithCode(app, "lucia@example.com", wrongCode(code))),
    );
    const codes = guesses.map((res) => res.body.error.code);
    expect(codes.filter((c) => c === "auth.code.wrong")).toHaveLength(4);
    expect(codes.filter((c) => c === "auth.code.expired")).toHaveLength(8);
    expect((await signInWithCode(app, "lucia@example.com", code)).status).toBe(401);
  });

  it("answers the same for an address that never got a code", async () => {
    const { app } = createTestApp();
    const res = await signInWithCode(app, "nobody@example.com", "123456");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.code.expired" } });
  });

  it("never stores the code in readable form", async () => {
    const { app, mailer } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM "sign_in_codes"');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it("keeps no usable code when the email can't be sent, and lets the person try again at once", async () => {
    const { app, mailer } = createTestApp();
    mailer.failing = true;
    const failed = await requestCode(app, "lucia@example.com");
    expect(failed.status).toBe(503);
    expect(failed.body).toEqual({ error: { code: "auth.email.send_failed" } });
    expect(await db.$queryRawUnsafe<unknown[]>('SELECT 1 FROM "sign_in_codes"')).toHaveLength(0);

    mailer.failing = false;
    expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
  });

  it("keeps the code already in the inbox working when a new one can't be sent", async () => {
    const { app, mailer, clock } = createTestApp();
    await requestCode(app, "lucia@example.com");
    const code = codeFrom(mailer, "lucia@example.com");

    clock.advance(MINUTE_MS);
    mailer.failing = true;
    expect((await requestCode(app, "lucia@example.com")).status).toBe(503);

    expect((await signInWithCode(app, "lucia@example.com", code)).status).toBe(200);
  });

  describe("rate limits per address", () => {
    it("allows one code every 60 seconds, saying how long to wait", async () => {
      const { app, clock } = createTestApp();
      await requestCode(app, "lucia@example.com");
      clock.advance(45 * 1000);

      const tooSoon = await requestCode(app, " LUCIA@example.com");
      expect(tooSoon.status).toBe(429);
      expect(tooSoon.body).toEqual({ error: { code: "auth.code.too_soon" } });
      expect(tooSoon.headers["retry-after"]).toBe("15");

      expect((await requestCode(app, "other@example.com")).status).toBe(204);
      clock.advance(15 * 1000);
      expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
    });

    it("allows 5 codes an hour", async () => {
      const { app, clock } = createTestApp();
      for (let i = 0; i < 5; i++) {
        expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
        clock.advance(2 * MINUTE_MS);
      }
      // 10 minutes after the first code: the first one leaves the hour 50 minutes from now.
      const limited = await requestCode(app, "lucia@example.com");
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ error: { code: "auth.code.too_soon" } });
      expect(limited.headers["retry-after"]).toBe(String(50 * 60));

      clock.advance(50 * MINUTE_MS);
      expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
    });

    it("allows 10 codes in 24 hours", async () => {
      const { app, clock } = createTestApp();
      for (let i = 0; i < 10; i++) {
        expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
        clock.advance(HOUR_MS);
      }
      const limited = await requestCode(app, "lucia@example.com");
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({ error: { code: "auth.code.daily_limit" } });

      clock.advance(14 * HOUR_MS);
      expect((await requestCode(app, "lucia@example.com")).status).toBe(204);
    });
  });
});
