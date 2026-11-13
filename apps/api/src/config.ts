import { z } from "zod";
import type { MailProvider } from "./email/mailer";

/** An `https://` origin with exactly one `*` and nothing after the host (ADR 0010). */
function isPreviewOriginPattern(pattern: string) {
  if (!pattern.startsWith("https://") || pattern.split("*").length !== 2) return false;
  const example = pattern.replace("*", "x");
  return URL.canParse(example) && new URL(example).origin === example;
}

const envSchema = z.object({
  DATABASE_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1, "Set GOOGLE_CLIENT_ID (see docs/setup-google-oauth.md)"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  WEB_ORIGIN: z.url(),
  WEB_PREVIEW_ORIGIN: z
    .string()
    .refine(
      isPreviewOriginPattern,
      "use an https:// origin with exactly one *, e.g. https://hogar-*-<scope>.vercel.app",
    )
    .optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  COOKIE_SECURE: z.stringbool().default(false),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  EMAIL_CODE_SECRET: z.string("Set EMAIL_CODE_SECRET").min(32, "EMAIL_CODE_SECRET must be at least 32 characters"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  MAILPIT_URL: z.url().optional(),
});

type Env = z.infer<typeof envSchema>;

/** Email always needs a provider: Resend in production, Mailpit locally (ADR 0008). */
function mailProviderFrom(values: Env): MailProvider | string {
  if (values.RESEND_API_KEY) {
    if (!values.EMAIL_FROM) return "EMAIL_FROM: set the sender on Hogar's verified domain to use Resend";
    return { kind: "resend", apiKey: values.RESEND_API_KEY, from: values.EMAIL_FROM };
  }
  if (values.MAILPIT_URL) {
    return { kind: "mailpit", url: values.MAILPIT_URL, from: values.EMAIL_FROM ?? "Hogar <hogar@localhost>" };
  }
  return "email: set RESEND_API_KEY or MAILPIT_URL (see docs/deploy.md)";
}

export interface Config {
  databaseUrl: string;
  googleClientId: string;
  jwtAccessSecret: string;
  webOrigin: string;
  /** On `dev` only: the project's Vercel preview origins, as a pattern with one `*` (ADR 0010). */
  webPreviewOrigin?: string;
  port: number;
  cookieSecure: boolean;
  /** Reverse proxies in front of the API; Express reads the client IP (for rate limiting) past them. */
  trustProxyHops: number;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  email: {
    /** HMAC key for sign-in codes; codes are never stored readable. */
    codeSecret: string;
    provider: MailProvider;
  };
}

/** Reads and validates the environment once at startup, failing fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const fail = (problems: string[]) => {
    throw new Error(`Invalid API environment. Check apps/api/.env:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  };
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  const values = parsed.data;
  const provider = mailProviderFrom(values);
  if (typeof provider === "string") return fail([provider]);
  return {
    databaseUrl: values.DATABASE_URL,
    googleClientId: values.GOOGLE_CLIENT_ID,
    jwtAccessSecret: values.JWT_ACCESS_SECRET,
    webOrigin: new URL(values.WEB_ORIGIN).origin,
    ...(values.WEB_PREVIEW_ORIGIN && { webPreviewOrigin: values.WEB_PREVIEW_ORIGIN }),
    port: values.PORT,
    cookieSecure: values.COOKIE_SECURE,
    trustProxyHops: values.TRUST_PROXY_HOPS,
    accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: values.REFRESH_TOKEN_TTL_DAYS,
    email: { codeSecret: values.EMAIL_CODE_SECRET, provider },
  };
}
