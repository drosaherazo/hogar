-- One person per email address, however they sign in (ADR 0008).

-- A person may have no Google account linked: everyone who signs up with a sign-in code.
ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;

-- Emails are compared ignoring case and surrounding spaces, so they are stored normalized.
-- If two people differ only by case this fails loudly on the unique index instead of merging
-- them; that should never happen, and if it does it needs a human decision.
UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));
