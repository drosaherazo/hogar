import { LOCALES } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { renderSignInCodeEmail, SIGN_IN_CODE_EMAIL_COPY } from "../src/email/signInCodeEmail";

describe("sign-in code email", () => {
  it("has the same copy keys in en and es, none empty", () => {
    const [en, es] = [SIGN_IN_CODE_EMAIL_COPY.en, SIGN_IN_CODE_EMAIL_COPY.es];
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const copy of [en, es]) for (const value of Object.values(copy)) expect(String(value).trim()).not.toBe("");
  });

  it.each([
    ["en", "482913 is your Hogar code", /10 minutes/, /safely ignore/i],
    ["es", "482913 es tu código de Hogar", /10 minutos/, /ignorar/i],
  ] as const)("in %s carries the code, its 10-minute life and the ignore notice", (locale, subject, life, ignore) => {
    const email = renderSignInCodeEmail("482913", locale);
    expect(email.subject).toBe(subject);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("482913");
      expect(body).toMatch(life);
      expect(body).toMatch(ignore);
    }
  });

  it.each(LOCALES)("in %s has no links, so nobody learns to click to sign in", (locale) => {
    const email = renderSignInCodeEmail("000123", locale);
    expect(email.html).not.toMatch(/<a[\s>]/i);
    expect(email.html).not.toMatch(/https?:\/\//i);
    expect(email.text).not.toMatch(/https?:\/\/|www\./i);
  });

  it("declares the email's language", () => {
    expect(renderSignInCodeEmail("000123", "es").html).toContain('<html lang="es">');
  });
});
