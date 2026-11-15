import { API_VERSION, API_VERSION_HEADER } from "@hogar/shared";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, signIn, WEB_ORIGIN } from "./testApp";

const outdated = { error: { code: "client.outdated" } };

describe("API version check", () => {
  it.each([
    ["the current version", API_VERSION],
    ["a newer version, since the web can deploy before the API", API_VERSION + 1],
  ])("lets a client on %s through", async (_, version) => {
    const { app } = createTestApp();
    const { auth } = await signIn(app);
    const res = await supertest(app).get("/api/me").set("Authorization", auth).set(API_VERSION_HEADER, String(version));
    expect(res.status).toBe(200);
  });

  it.each([
    ["an older version", String(API_VERSION - 1)],
    ["no version", undefined],
    ["a version that isn't a whole number", "1.5"],
    ["garbage", "latest"],
  ])("tells a client with %s to update", async (_, version) => {
    const { app } = createTestApp();
    const req = supertest(app).get("/api/me");
    if (version !== undefined) req.set(API_VERSION_HEADER, version);
    const res = await req;
    expect(res.status).toBe(426);
    expect(res.body).toEqual(outdated);
  });

  it("checks auth requests too, before anything else", async () => {
    const { app } = createTestApp();
    const res = await supertest(app).post("/api/auth/refresh");
    expect(res.status).toBe(426);
    expect(res.body).toEqual(outdated);
  });

  it("leaves the refresh token untouched when it refuses a refresh, so updating keeps the session", async () => {
    const { app } = createTestApp();
    const login = await supertest(app)
      .post("/api/auth/google")
      .set("Origin", WEB_ORIGIN)
      .set(API_VERSION_HEADER, String(API_VERSION))
      .send({ credential: "valid-ana-token" });
    const cookie = String(login.headers["set-cookie"]);
    const refresh = (version?: number) => {
      const req = supertest(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("Cookie", cookie);
      return version === undefined ? req : req.set(API_VERSION_HEADER, String(version));
    };
    expect((await refresh()).status).toBe(426);
    expect((await refresh(API_VERSION)).status).toBe(200);
  });

  it("answers the health check without a version, so waking the server always works", async () => {
    const { app } = createTestApp();
    const res = await supertest(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
