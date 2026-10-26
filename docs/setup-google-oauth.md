# Setting up Google sign-in

Hogar signs people in with **Google Identity Services**: the browser shows Google's button, Google hands back a signed ID token, and our API verifies it. For that you need an **OAuth Client ID** from Google Cloud. It's free and takes about ten minutes.

You only need the **Client ID**. It's public (it ends up in the web page), and this flow needs **no client secret**.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> and sign in with your Google account.
2. Open the project picker at the top → **New project**.
3. Name it `Hogar` and click **Create**. Make sure it's selected afterwards.

## 2. Configure the consent screen (Google Auth Platform)

1. In the search bar, open **Google Auth Platform** (it may appear as _APIs & Services › OAuth consent screen_).
2. Click **Get started** and fill in **Branding**:
   - **App name:** `Hogar`
   - **User support email:** your email
3. **Audience:** choose **External**.
4. **Contact information:** your email. Accept the policy and click **Create**.
5. Go to **Audience › Test users** and **add your own Gmail address** (and anyone else who will try the app). While the app is in _Testing_, only these people can sign in.
6. Scopes: nothing to add. The default `openid`, `email` and `profile` are exactly what Hogar uses (name, email and photo).

## 3. Create the OAuth client

1. Go to **Clients** → **Create client**.
2. **Application type:** _Web application_. **Name:** `Hogar web (local)`.
3. **Authorized JavaScript origins** → add both:
   - `http://localhost:5173`
   - `http://localhost`
4. **Authorized redirect URIs:** leave empty (the button uses a popup, not redirects).
5. Click **Create** and copy the **Client ID** (it looks like `1234567890-abc123.apps.googleusercontent.com`).

> New clients can take a few minutes to start working. If the button says the origin isn't allowed, wait five minutes and reload.

## 4. Put the Client ID in both apps

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

- `apps/web/.env` → `VITE_GOOGLE_CLIENT_ID=<your client id>`
- `apps/api/.env` → `GOOGLE_CLIENT_ID=<the same client id>`

The API also needs `JWT_ACCESS_SECRET`; the comment in `.env.example` shows how to generate one. `.env` files are git-ignored.

Restart `pnpm dev` after editing `.env` files.

## 5. Try it

1. `pnpm db:up && pnpm db:migrate && pnpm dev`
2. Open <http://localhost:5173>, click **Continue with Google** and pick one of your test users.
3. You should land on the home page with your name and photo. Reloading keeps you signed in; **Sign out** in the account menu ends the session.

## Troubleshooting

| What you see                                         | Why                                                               | Fix                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| "Google sign-in isn't set up yet" on the login page  | `VITE_GOOGLE_CLIENT_ID` is empty                                  | Fill it in `apps/web/.env` and restart `pnpm dev`                                        |
| The API exits with "Set GOOGLE_CLIENT_ID"            | Missing in `apps/api/.env`                                        | Fill it and restart                                                                      |
| Google says "origin not allowed" / `origin_mismatch` | The origin isn't in the client's list, or the client is brand new | Check both `http://localhost:5173` and `http://localhost` are listed; wait a few minutes |
| Google says "access blocked" / app not verified      | Your account isn't a test user                                    | Add it under **Audience › Test users**                                                   |
| "We couldn't verify your Google sign-in"             | The web and API use different Client IDs                          | Use the same ID in both `.env` files                                                     |

## Going to production (later)

- Add the production web origin (for example `https://hogar.vercel.app`) to **Authorized JavaScript origins**.
- In the API set `WEB_ORIGIN` to that origin and `COOKIE_SECURE=true`.
- Publish the app in **Audience** so anyone with a Google account can sign in (basic scopes don't require Google's verification review).
