import { API_VERSION, API_VERSION_HEADER } from "@hogar/shared";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, signIn } from "./testApp";

const outdated = { error: { code: "client.outdated" } };

describe("API version check", () => {
  it("lets a client on the current version through", async () => {
    const { app } = createTestApp();
    const { auth } = await signIn(app);
    const res = await supertest(app)
      .get("/api/me")
      .set("Authorization", auth)
      .set(API_VERSION_HEADER, String(API_VERSION));
    expect(res.status).toBe(200);
  });

  it("lets a newer client through, since the web can deploy before the API", async () => {
    const { app } = createTestApp();
    const { auth } = await signIn(app);
    const res = await supertest(app)
      .get("/api/me")
      .set("Authorization", auth)
      .set(API_VERSION_HEADER, String(API_VERSION + 1));
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

  it("answers the health check without a version, so waking the server always works", async () => {
    const { app } = createTestApp();
    const res = await supertest(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
