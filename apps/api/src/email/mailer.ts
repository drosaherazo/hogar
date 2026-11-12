/** One email, always with a plain-text part next to the HTML. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends email (ADR 0008). Injected into the app like `GoogleVerifier`, so changing provider
 * touches one adapter and tests use a recording fake. Rejects when the email could not be sent.
 */
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export type MailProvider =
  { kind: "resend"; apiKey: string; from: string } | { kind: "mailpit"; url: string; from: string };

interface AdapterOptions {
  from: string;
  /** Injectable for tests; defaults to Node's built-in `fetch`. */
  fetch?: typeof fetch;
}

async function post(fetchImpl: typeof fetch, url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider answered ${res.status} at ${url}`);
}

/** Production: Resend's HTTP API (Render's free plan blocks SMTP). */
export function createResendMailer({ apiKey, from, fetch: fetchImpl = fetch }: AdapterOptions & { apiKey: string }) {
  return {
    async send({ to, subject, html, text }) {
      await post(
        fetchImpl,
        "https://api.resend.com/emails",
        { from, to: [to], subject, html, text },
        { Authorization: `Bearer ${apiKey}` },
      );
    },
  } satisfies Mailer;
}

/** Splits `"Hogar <hola@hogar.app>"` into its name and address; a bare address has no name. */
function parseAddress(address: string): { Name?: string; Email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(address);
  if (!match?.[2]) return { Email: address.trim() };
  return match[1] ? { Name: match[1], Email: match[2] } : { Email: match[2] };
}

/** Development: Mailpit's HTTP send API, so emails open in a local inbox in the browser. */
export function createMailpitMailer({ url, from, fetch: fetchImpl = fetch }: AdapterOptions & { url: string }) {
  const endpoint = new URL("api/v1/send", url.endsWith("/") ? url : `${url}/`).toString();
  return {
    async send({ to, subject, html, text }) {
      await post(fetchImpl, endpoint, {
        From: parseAddress(from),
        To: [{ Email: to }],
        Subject: subject,
        HTML: html,
        Text: text,
      });
    },
  } satisfies Mailer;
}

export function createMailer(provider: MailProvider): Mailer {
  return provider.kind === "resend" ? createResendMailer(provider) : createMailpitMailer(provider);
}
