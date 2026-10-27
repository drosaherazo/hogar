import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, WEB_ORIGIN } from "./testApp";

function refreshFrom(app: ReturnType<typeof createTestApp>["app"], forwardedFor: string) {
  return request(app).post("/api/auth/refresh").set("Origin", WEB_ORIGIN).set("X-Forwarded-For", forwardedFor);
}

describe("auth rate limit", () => {
  it("limits each client separately behind a trusted proxy", async () => {
    const { app } = createTestApp({ authRateLimit: 2, trustProxyHops: 1 });

    await refreshFrom(app, "203.0.113.1");
    await refreshFrom(app, "203.0.113.1");
    const limited = await refreshFrom(app, "203.0.113.1");
    const otherClient = await refreshFrom(app, "203.0.113.2");

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: "request.rate_limited" } });
    expect(otherClient.status).toBe(401);
  });

  it("ignores X-Forwarded-For when no proxy is trusted, so it cannot be spoofed", async () => {
    const { app } = createTestApp({ authRateLimit: 2 });

    await refreshFrom(app, "203.0.113.1");
    await refreshFrom(app, "203.0.113.2");
    const spoofed = await refreshFrom(app, "203.0.113.3");

    expect(spoofed.status).toBe(429);
  });
});
