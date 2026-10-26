import { authResponseSchema, authUserSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAccessTokenSigner } from "../src/auth/tokens";
import { ana, config, createTestApp, db, WEB_ORIGIN } from "./testApp";

async function loginAsAna(app: ReturnType<typeof createTestApp>["app"]) {
  const res = await request(app)
    .post("/api/auth/google")
    .set("Origin", WEB_ORIGIN)
    .send({ credential: "valid-ana-token" });
  return authResponseSchema.parse(res.body);
}

describe("GET /api/me", () => {
  it("returns the signed-in user", async () => {
    const { app } = createTestApp();
    const { accessToken, user } = await loginAsAna(app);
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(authUserSchema.parse(res.body)).toEqual(user);
    expect(res.body.email).toBe(ana.email);
  });

  it.each([
    ["no header", undefined],
    ["wrong scheme", "Basic abc"],
    ["garbage token", "Bearer not-a-jwt"],
  ])("rejects requests with %s", async (_, header) => {
    const { app } = createTestApp();
    const req = request(app).get("/api/me");
    if (header) req.set("Authorization", header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.token.invalid" } });
  });

  it("rejects a token signed with another secret", async () => {
    const { app } = createTestApp();
    const { user } = await loginAsAna(app);
    const forged = await createAccessTokenSigner("someone-elses-secret-that-is-long-enough", 900).sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
      locale: "en",
    });
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { app } = createTestApp();
    const { user } = await loginAsAna(app);
    const expired = await createAccessTokenSigner(config.jwtAccessSecret, 1).sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
      locale: "en",
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it("rejects a valid token for a user that no longer exists", async () => {
    const { app } = createTestApp();
    const { accessToken } = await loginAsAna(app);
    await db.user.deleteMany();
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe("unknown routes", () => {
  it("answer 404 with an error code", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });
});
