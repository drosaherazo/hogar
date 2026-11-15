import { API_VERSION, API_VERSION_HEADER } from "@hogar/shared";
import supertest from "supertest";

type App = Parameters<typeof supertest>[0];

/**
 * Supertest with the `X-Hogar-Api-Version` header the web's API client sends on every request, so
 * endpoint tests talk to the API the way the current web does. Use plain `supertest` only to test
 * the version check itself.
 */
export function request(app: App) {
  const api = supertest(app);
  const version = String(API_VERSION);
  return {
    get: (url: string) => api.get(url).set(API_VERSION_HEADER, version),
    post: (url: string) => api.post(url).set(API_VERSION_HEADER, version),
    put: (url: string) => api.put(url).set(API_VERSION_HEADER, version),
    patch: (url: string) => api.patch(url).set(API_VERSION_HEADER, version),
    delete: (url: string) => api.delete(url).set(API_VERSION_HEADER, version),
  };
}
