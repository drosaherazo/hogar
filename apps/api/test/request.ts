import { API_VERSION, API_VERSION_HEADER } from "@hogar/shared";
import supertest from "supertest";

type App = Parameters<typeof supertest>[0];

/**
 * Supertest with the `X-Hogar-Api-Version` header the web's API client sends on every request, so
 * endpoint tests talk to the API the way the current web does. Use plain `supertest` only to test
 * the version check itself.
 */
export function request(app: App) {
  const test = supertest(app);
  const version = String(API_VERSION);
  return {
    get: (url: string) => test.get(url).set(API_VERSION_HEADER, version),
    post: (url: string) => test.post(url).set(API_VERSION_HEADER, version),
    put: (url: string) => test.put(url).set(API_VERSION_HEADER, version),
    patch: (url: string) => test.patch(url).set(API_VERSION_HEADER, version),
    delete: (url: string) => test.delete(url).set(API_VERSION_HEADER, version),
  };
}
