import { createApp } from "./app";
import { createGoogleVerifier } from "./auth/googleVerifier";
import { loadConfig } from "./config";
import { createDatabase } from "./db";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const app = createApp({ config, db, google: createGoogleVerifier(config.googleClientId) });

const server = app.listen(config.port, () => {
  console.log(`Hogar API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await db.$disconnect();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
