import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base = {
  DATABASE_URL: "postgresql://hogar:hogar@localhost:5432/hogar",
  GOOGLE_CLIENT_ID: "client-id",
  JWT_ACCESS_SECRET: "a".repeat(32),
  WEB_ORIGIN: "http://localhost:5173",
  EMAIL_CODE_SECRET: "b".repeat(32),
  MAILPIT_URL: "http://localhost:8025",
};

describe("loadConfig: email", () => {
  it("uses Mailpit when MAILPIT_URL is set", () => {
    expect(loadConfig(base).email).toEqual({
      codeSecret: "b".repeat(32),
      provider: { kind: "mailpit", url: "http://localhost:8025", from: "Hogar <hogar@localhost>" },
    });
  });

  it("prefers Resend when its key is set, sending from EMAIL_FROM", () => {
    const config = loadConfig({ ...base, RESEND_API_KEY: "re_123", EMAIL_FROM: "Hogar <hola@hogar.example>" });
    expect(config.email.provider).toEqual({ kind: "resend", apiKey: "re_123", from: "Hogar <hola@hogar.example>" });
  });

  it("requires EMAIL_FROM with Resend, so production never sends from a placeholder", () => {
    expect(() => loadConfig({ ...base, MAILPIT_URL: undefined, RESEND_API_KEY: "re_123" })).toThrow(/EMAIL_FROM/);
  });

  it("refuses to start without an email provider", () => {
    expect(() => loadConfig({ ...base, MAILPIT_URL: undefined })).toThrow(/RESEND_API_KEY or MAILPIT_URL/);
  });

  it.each([undefined, "too-short"])("requires an EMAIL_CODE_SECRET of at least 32 characters (%s)", (secret) => {
    expect(() => loadConfig({ ...base, EMAIL_CODE_SECRET: secret })).toThrow(/EMAIL_CODE_SECRET/);
  });
});
