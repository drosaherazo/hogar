import { describe, expect, it, vi } from "vitest";
import { createMailpitMailer, createResendMailer, type EmailMessage } from "../src/email/mailer";

const message: EmailMessage = {
  to: "ana@example.com",
  subject: "482913 is your Hogar code",
  html: "<p>482913</p>",
  text: "482913",
};

function stubFetch(response: Response) {
  return vi.fn<typeof fetch>(async () => response);
}

function sentRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url, init, body: JSON.parse(String(init?.body)) as unknown };
}

describe("Resend mailer", () => {
  it("posts the email to Resend's API with the key as a Bearer token", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    const mailer = createResendMailer({ apiKey: "re_123", from: "Hogar <hola@hogar.example>", fetch: fetchMock });

    await mailer.send(message);

    const { url, init, body } = sentRequest(fetchMock);
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer re_123");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(body).toEqual({
      from: "Hogar <hola@hogar.example>",
      to: ["ana@example.com"],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });

  it("fails when Resend answers with an error", async () => {
    const mailer = createResendMailer({
      apiKey: "re_123",
      from: "Hogar <hola@hogar.example>",
      fetch: stubFetch(new Response("{}", { status: 429 })),
    });
    await expect(mailer.send(message)).rejects.toThrow(/429/);
  });
});

describe("Mailpit mailer", () => {
  it("posts the email to Mailpit's send API", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ ID: "1" }), { status: 200 }));
    const mailer = createMailpitMailer({
      url: "http://localhost:8025/",
      from: "Hogar <hogar@localhost>",
      fetch: fetchMock,
    });

    await mailer.send(message);

    const { url, body } = sentRequest(fetchMock);
    expect(url).toBe("http://localhost:8025/api/v1/send");
    expect(body).toEqual({
      From: { Name: "Hogar", Email: "hogar@localhost" },
      To: [{ Email: "ana@example.com" }],
      Subject: message.subject,
      HTML: message.html,
      Text: message.text,
    });
  });

  it("fails when Mailpit answers with an error", async () => {
    const mailer = createMailpitMailer({
      url: "http://localhost:8025",
      from: "hogar@localhost",
      fetch: stubFetch(new Response("bad", { status: 400 })),
    });
    await expect(mailer.send(message)).rejects.toThrow(/400/);
  });
});
