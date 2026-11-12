# 0008 · Email sign-in codes and one person per email address

- **Status:** accepted
- **Date:** 2026-11-12
- **Extends:** ADR 0002 (sessions are unchanged; sign-in and the person record change)

## Context

Until now Hogar only let people in with Google, which shuts out everyone without a Google account or who doesn't want to use it here. Sign in with Apple was ruled out because it needs a paid developer membership (US$99/year). Anyone with an email address can receive a code, so that is the second sign-in method.

## Decision

### Sign-in code

- A person asks for a code for an email address and gets a **6-digit code** by email, in their language. There is **no sign-in link**: a link opens on whichever device reads the email, corporate mail scanners can use it up first, and an "Enter" button in an email teaches people to click phishing.
- A code works **once**, for **10 minutes**, and stops working after **5 wrong attempts**. Asking for a new code makes the previous one stop working.
- Per email address: at most one code every **60 seconds**, **5 per hour** and **10 per 24 hours**. The daily cap is what keeps guessing out of reach. Without it, 5 codes an hour with 5 attempts each let an attacker try about 600 codes a day, about a 2 % chance of getting in within a month. With it, the chance stays under 0.2 % a month.
- Codes are stored as an **HMAC-SHA-256 with a server secret** (`EMAIL_CODE_SECRET`), not a plain SHA-256. A 6-digit code has a million values, so a plain hash would be reversed instantly from a leaked database.
- Asking for a code gets the **same response** whether or not the address belongs to someone, so the endpoint can't be used to find out who uses Hogar.
- A valid code starts a session exactly as Google sign-in does (ADR 0002).

### One person per email address

- `User.email` stays unique and is compared **ignoring case and surrounding spaces**. `+` addresses are distinct, with no provider-specific rules.
- A valid code for an address that has no person yet creates one, with the language the login page is showing.
- Google sign-in looks the person up **first by Google `sub`, then by verified email**. When found by email, the Google identity is linked. A person has **at most one Google account linked**: if a different Google account arrives with the email of a person who already has one, sign-in is refused (`auth.google.already_linked`), and the error suggests a sign-in code.
- **Changes from ADR 0002:** Google no longer overwrites the person's name or email on each sign-in. The name from Google is only used when the person is created, and the photo is still refreshed. Once linked, the person is recognized by `sub`, so a changed Google email never collides with another person.

### Names

A new person without a name (everyone who signs up with a code, and Google sign-ups without one) gets a **starter name**: an animal and a friendly adjective in their language, from a closed list of about 20 × 20 reviewed in both languages ("Brave Otter", "Nutria Valiente"). Starter names are not unique, because names never were. So the name is never empty, and nothing has to block a nameless person from a household. Changing one's name is the next feature.

### Sending email

Render's free web services block outbound SMTP (ports 25, 465 and 587), so email goes through **Resend's HTTP API**, from Hogar's own domain with SPF and DKIM. The free plan's 100 emails a day are enough for now. If a send fails, no code is created and the person is asked to try again. The API depends on a small `Mailer` interface: Resend in production, Mailpit (Docker Compose) in development, and a fake that records sent emails in tests, as with the fake Google verifier.

## Considered options

- **Magic link instead of a code:** rejected for the reasons above.
- **Email follows the Google account's email:** needs a refusal when the new address belongs to someone else, for little benefit.
- **Several Google accounts per person:** needs a linked-identities table for a very rare case.
- **A mandatory "what should your household call you?" step:** replaced by starter names. Nothing can be left without a name, and there is no step to skip or resume.

## Consequences

- `User.googleId` becomes optional. People who signed up before this keep signing in with Google exactly as before.
- Whoever controls an email address controls the matching person in Hogar. This is inherent to email sign-in and accepted.
- Hogar now sends email, which makes invitation emails (v1.1) cheap to add later. They stay out of the MVP.
