import { authResponseSchema, type AuthUser } from "@hogar/shared";
import request from "supertest";
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
  trustProxyHops: 0,
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

export function createTestApp({
  authRateLimit = 1000,
  ...overrides
}: { authRateLimit?: number } & Partial<Config> = {}) {
  const google = new FakeGoogleVerifier();
  for (const identity of PEOPLE) google.identities.set(credentialFor(identity), identity);
  const clock = new TestClock();
  const app = createApp({ config: { ...config, ...overrides }, db, google, authRateLimit, now: clock.now });
  return { app, google, clock };
}

const person = (key: string, name: string): GoogleIdentity => ({
  googleId: `google-${key}`,
  email: `${key}@example.com`,
  emailVerified: true,
  name,
  avatarUrl: null,
  locale: "es",
});

/** More people for household tests; Ana stays the default signed-in user. */
export const bruno = person("bruno", "Bruno Díaz");
export const carla = person("carla", "Carla Ruiz");
export const dani = person("dani", "Dani López");
const PEOPLE = [ana, bruno, carla, dani];

function credentialFor(identity: GoogleIdentity) {
  return identity === ana ? "valid-ana-token" : `valid-${identity.googleId}-token`;
}

export interface SignedIn {
  user: AuthUser;
  /** Value for the `Authorization` header. */
  auth: string;
}

/** Signs `identity` in through the real Google login endpoint and returns a ready Bearer header. */
export async function signIn(app: ReturnType<typeof createTestApp>["app"], identity: GoogleIdentity = ana) {
  const res = await request(app)
    .post("/api/auth/google")
    .set("Origin", WEB_ORIGIN)
    .send({ credential: credentialFor(identity) });
  const session = authResponseSchema.parse(res.body);
  return { user: session.user, auth: `Bearer ${session.accessToken}` } satisfies SignedIn;
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "invitations", "memberships", "households", "refresh_tokens", "users" CASCADE',
  );
});

afterAll(async () => {
  await db.$disconnect();
});
