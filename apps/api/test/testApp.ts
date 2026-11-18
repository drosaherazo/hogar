import type { AddressInfo } from "node:net";
import { authResponseSchema, type AuthUser } from "@hogar/shared";
import { afterAll, beforeEach } from "vitest";
import { createApp, type AppDeps } from "../src/app";
import { createApiServer } from "../src/createApiServer";
import type { GoogleIdentity, GoogleVerifier } from "../src/auth/googleVerifier";
import type { EmailMessage, Mailer } from "../src/email/mailer";
import type { Config } from "../src/config";
import { createDatabase } from "../src/db";
import { request } from "./request";

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
  email: {
    codeSecret: "test-email-code-secret-that-is-long-enough",
    provider: { kind: "mailpit", url: "http://mailpit.invalid", from: "Hogar <hogar@localhost>" },
  },
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

/** Fake mailer: records every email it sends, or fails while `failing` is set. */
export class RecordingMailer implements Mailer {
  readonly sent: EmailMessage[] = [];
  failing = false;

  async send(message: EmailMessage) {
    if (this.failing) throw new Error("Fake email provider is down");
    this.sent.push(message);
  }

  /** The most recent email sent to `to`. */
  lastTo(to: string): EmailMessage {
    const message = this.sent.findLast((sent) => sent.to === to);
    if (!message) throw new Error(`No email was sent to ${to}`);
    return message;
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

type TestAppOptions = { authRateLimit?: number; invitationRateLimit?: number } & Partial<Config>;

function testDeps({ authRateLimit = 1000, invitationRateLimit = 1000, ...overrides }: TestAppOptions) {
  const google = new FakeGoogleVerifier();
  for (const identity of PEOPLE) google.identities.set(credentialFor(identity), identity);
  const clock = new TestClock();
  const mailer = new RecordingMailer();
  const deps: AppDeps = {
    config: { ...config, ...overrides },
    db,
    google,
    mailer,
    authRateLimit,
    invitationRateLimit,
    now: clock.now,
  };
  return { deps, google, mailer, clock };
}

export function createTestApp(options: TestAppOptions = {}) {
  const { deps, ...fakes } = testDeps(options);
  return { app: createApp(deps), ...fakes };
}

/**
 * The whole API listening on a free port, real time included, for tests that connect a real
 * Socket.io client to `url`. `app` takes HTTP requests as in `createTestApp`. Close it after each test.
 */
export async function startTestApi(options: TestAppOptions = {}) {
  const { deps, ...fakes } = testDeps(options);
  const api = createApiServer(deps);
  await new Promise<void>((resolve) => api.server.listen(0, "127.0.0.1", resolve));
  const { port } = api.server.address() as AddressInfo;
  return { app: api.app, url: `http://127.0.0.1:${port}`, close: api.close, ...fakes };
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
    'TRUNCATE TABLE "expense_shares", "category_weights", "expenses", "expense_categories", "settlements", "invitations", "memberships", "households", "refresh_tokens", "sign_in_codes", "users" CASCADE',
  );
});

afterAll(async () => {
  await db.$disconnect();
});
