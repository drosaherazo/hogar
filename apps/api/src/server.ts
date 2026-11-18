import { createGoogleVerifier } from "./auth/googleVerifier";
import { loadConfig } from "./config";
import { createApiServer } from "./createApiServer";
import { createMailer } from "./email/mailer";
import { createDatabase } from "./db";

const config = loadConfig();
const db = createDatabase(config.databaseUrl);
const api = createApiServer({
  config,
  db,
  google: createGoogleVerifier(config.googleClientId),
  mailer: createMailer(config.email.provider),
});

api.server.listen(config.port, () => {
  console.log(`Hogar API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  await api.close();
  await db.$disconnect();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
