import { OAuth2Client } from "google-auth-library";

/** What we keep from a verified Google ID token. */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
  locale: string | null;
}

/** Verifies a Google ID token. Injected into the app so tests can use a fake. */
export interface GoogleVerifier {
  /** Resolves with the identity, or `null` when the token is invalid, expired or for another client. */
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

export function createGoogleVerifier(clientId: string): GoogleVerifier {
  const client = new OAuth2Client({ clientId });
  return {
    async verify(idToken) {
      try {
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) return null;
        return {
          googleId: payload.sub,
          email: payload.email,
          emailVerified: payload.email_verified === true,
          name: payload.name ?? payload.email,
          avatarUrl: payload.picture ?? null,
          locale: payload.locale ?? null,
        };
      } catch {
        return null;
      }
    },
  };
}
