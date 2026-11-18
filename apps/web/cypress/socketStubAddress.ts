// Types only: Vite and Cypress load this file with plain Node, which can't read the shared sources.
import type { SOCKET_PATH } from "@hogar/shared";

/** Where the E2E socket stub listens; in E2E mode Vite forwards the live connection here. */
export const E2E_SOCKET_PORT = 5190;

/** The web's live connection path; the type keeps it equal to the shared constant. */
export const E2E_SOCKET_PATH: typeof SOCKET_PATH = "/api/socket.io";
