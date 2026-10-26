import { afterAll, beforeEach } from "vitest";
import { createApp } from "../src/app";
import type { GoogleIdentity, GoogleVerifier } from "../src/auth/googleVerifier";
import type { Config } from "../src/config";
import { createDatabase } from "../src/db";

try {
  process.loadEnvFile();
} catch {
  // CI provides real environment variables.
}

export const WEB_ORIGIN = "http://localhost:5173";

export const config: Config = {
  databaseUrl: process.env["TEST_DATABASE_URL"] ?? "",
  googleClientId: "test-client-id",
  jwtAccessSecret: "test-secret-that-is-long-enough-for-hs256-signing",
  webOrigin: WEB_ORIGIN,
  port: 0,
  cookieSecure: true,
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};

export const db = createDatabase(config.databaseUrl);

export const ana: GoogleIdentity = {
  googleId: "google-ana",
  email: "ana@example.com",
  emailVerified: true,
  name: "Ana García",
  avatarUrl: "https://lh3.googleusercontent.com/a/ana",
  locale: "es",
};

/** Fake Google: each test registers which ID tokens are valid and who they belong to. */
export class FakeGoogleVerifier implements GoogleVerifier {
  readonly identities = new Map<string, GoogleIdentity>();

  async verify(idToken: string) {
    return this.identities.get(idToken) ?? null;
  }
}

/** A controllable clock so expiry and grace windows can be tested without waiting. */
export class TestClock {
  current = new Date("2026-10-26T10:00:00Z");
  now = () => new Date(this.current);
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export function createTestApp() {
  const google = new FakeGoogleVerifier();
  google.identities.set("valid-ana-token", ana);
  const clock = new TestClock();
  const app = createApp({ config, db, google, authRateLimit: 1000, now: clock.now });
  return { app, google, clock };
}

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "refresh_tokens", "users" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});
