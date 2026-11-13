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

describe("loadConfig: preview origins (ADR 0010)", () => {
  it("leaves the preview pattern unset by default, so only WEB_ORIGIN is trusted", () => {
    expect(loadConfig(base).webPreviewOrigin).toBeUndefined();
  });

  it("loads a pattern with one wildcard", () => {
    const pattern = "https://hogar-*-drosa-projects.vercel.app";
    expect(loadConfig({ ...base, WEB_PREVIEW_ORIGIN: pattern }).webPreviewOrigin).toBe(pattern);
  });

  it.each([
    ["no wildcard", "https://hogar-drosa-projects.vercel.app"],
    ["two wildcards", "https://hogar-*-*.vercel.app"],
    ["plain http", "http://hogar-*-drosa-projects.vercel.app"],
    ["a path", "https://hogar-*-drosa-projects.vercel.app/api"],
    ["a trailing slash", "https://hogar-*-drosa-projects.vercel.app/"],
    ["a query", "https://hogar-*-drosa-projects.vercel.app?x=1"],
    ["a fragment", "https://hogar-*-drosa-projects.vercel.app#x"],
    ["a wildcard that is a whole host label", "https://*.vercel.app"],
    ["a wildcard that is the whole host", "https://*"],
    ["no fixed text after the wildcard in its label", "https://hogar-*.vercel.app"],
    ["no fixed text before the wildcard in its label", "https://*-drosa-projects.vercel.app"],
    ["not a URL", "hogar-*"],
  ])("refuses to start with %s", (_case, pattern) => {
    expect(() => loadConfig({ ...base, WEB_PREVIEW_ORIGIN: pattern })).toThrow(/WEB_PREVIEW_ORIGIN/);
  });
});
