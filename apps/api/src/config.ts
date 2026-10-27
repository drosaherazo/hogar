import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1, "Set GOOGLE_CLIENT_ID (see docs/setup-google-oauth.md)"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  COOKIE_SECURE: z.stringbool().default(false),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export interface Config {
  databaseUrl: string;
  googleClientId: string;
  jwtAccessSecret: string;
  webOrigin: string;
  port: number;
  cookieSecure: boolean;
  /** Reverse proxies in front of the API; Express reads the client IP (for rate limiting) past them. */
  trustProxyHops: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
}

/** Reads and validates the environment once at startup, failing fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid API environment. Check apps/api/.env:\n${problems}`);
  }
  const values = parsed.data;
  return {
    databaseUrl: values.DATABASE_URL,
    googleClientId: values.GOOGLE_CLIENT_ID,
    jwtAccessSecret: values.JWT_ACCESS_SECRET,
    webOrigin: new URL(values.WEB_ORIGIN).origin,
    port: values.PORT,
    cookieSecure: values.COOKIE_SECURE,
    trustProxyHops: values.TRUST_PROXY_HOPS,
    accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: values.REFRESH_TOKEN_TTL_DAYS,
  };
}
