import type { Locale } from "@hogar/shared";
import type { EmailMessage } from "./mailer";

/** How long a sign-in code works, as the email says it. Kept in sync with the auth service. */
export const SIGN_IN_CODE_MINUTES = 10;

interface Copy {
  subject: (code: string) => string;
  preheader: string;
  greeting: string;
  intro: string;
  lifetime: string;
  ignore: string;
  noLinks: string;
  signOff: string;
}

/**
 * The sign-in code email in each language (ADR 0008). Warm and short: the code first, how long
 * it works, and that ignoring it is safe. It never contains a link: Hogar never asks anyone to
 * click to sign in, so a link in a "Hogar" email is always a red flag.
 */
export const SIGN_IN_CODE_EMAIL_COPY: Record<Locale, Copy> = {
  en: {
    subject: (code) => `${code} is your Hogar code`,
    preheader: "Type it in Hogar to sign in.",
    greeting: "Hi there!",
    intro: "Here's your code to sign in to Hogar:",
    lifetime: `It works for ${SIGN_IN_CODE_MINUTES} minutes, and only once.`,
    ignore: "Didn't ask for it? You can safely ignore this email; nobody can get in without the code.",
    noLinks: "Hogar will never send you a link to sign in. Just type the code.",
    signOff: "See you at home,\nHogar",
  },
  es: {
    subject: (code) => `${code} es tu código de Hogar`,
    preheader: "Escríbelo en Hogar para entrar.",
    greeting: "¡Hola!",
    intro: "Aquí tienes tu código para entrar en Hogar:",
    lifetime: `Funciona durante ${SIGN_IN_CODE_MINUTES} minutos y una sola vez.`,
    ignore: "¿No lo has pedido? Puedes ignorar este email tranquilamente; nadie puede entrar sin el código.",
    noLinks: "Hogar nunca te enviará un enlace para entrar. Solo tienes que escribir el código.",
    signOff: "Nos vemos en casa,\nHogar",
  },
};

/*
 * Email clients ignore CSS custom properties and stylesheets, so the brand's tokens are inlined
 * here as hex values, mirroring packages/ui/src/tokens/primitives.css (light theme). Contrast:
 * ink-900 on white and ink-600 on white pass AA; fuchsia-600 is only used for the large code.
 */
const COLOR = {
  bg: "#fbf8fa", // --ink-25
  surface: "#ffffff", // --ink-0
  sunken: "#f4eff3", // --ink-50
  text: "#1f1a21", // --ink-900
  muted: "#5d5360", // --ink-600
  brand: "#c2126a", // --fuchsia-600
};
const FONT = "Figtree, 'Segoe UI', Helvetica, Arial, sans-serif";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraph = (text: string, style = "") =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;${style}">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;

/** The sign-in email for `code` in `locale`, with HTML and plain-text parts and no links. */
export function renderSignInCodeEmail(code: string, locale: Locale): Omit<EmailMessage, "to"> {
  const copy = SIGN_IN_CODE_EMAIL_COPY[locale];
  // The code stays as plain digits (letter-spacing does the visual grouping), so copying it and
  // the phone's offer to fill it in always get exactly the code.

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(copy.subject(code))}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.bg};color:${COLOR.text};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(copy.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${COLOR.surface};border-radius:16px;">
<tr><td style="padding:32px 28px;">
${paragraph(copy.greeting, "font-size:20px;font-weight:600;")}
${paragraph(copy.intro)}
<p style="margin:0 0 16px;padding:16px;border-radius:12px;background-color:${COLOR.sunken};text-align:center;font-size:36px;font-weight:700;letter-spacing:6px;color:${COLOR.brand};font-variant-numeric:tabular-nums;">${escapeHtml(code)}</p>
${paragraph(copy.lifetime)}
${paragraph(copy.ignore, `color:${COLOR.muted};`)}
${paragraph(copy.noLinks, `color:${COLOR.muted};`)}
${paragraph(copy.signOff, "margin:0;")}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const text = [
    copy.greeting,
    "",
    copy.intro,
    "",
    code,
    "",
    copy.lifetime,
    "",
    copy.ignore,
    copy.noLinks,
    "",
    copy.signOff,
    "",
  ].join("\n");

  return { subject: copy.subject(code), html, text };
}
