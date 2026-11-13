import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

// ADR 0010: only production's host may reach the production API; every other host
// (dev and every preview) reaches the dev API, so a preview never touches real data.
const PRODUCTION_HOST = "hogar.therandomcollection.co";
const PRODUCTION_API = "https://hogar-api-m5va.onrender.com/";
const DEV_API = "https://hogar-api-dev.onrender.com/";

type Rewrite = { source: string; destination: string; has?: { type: string; value?: string }[] };

const rewrites: Rewrite[] = vercelConfig.rewrites;
const reachesProduction = (rewrite: Rewrite) => rewrite.destination.startsWith(PRODUCTION_API);
const isOnlyForProductionHost = (rewrite: Rewrite) =>
  rewrite.has?.length === 1 && rewrite.has[0]?.type === "host" && rewrite.has[0].value === PRODUCTION_HOST;

describe("the web's /api rewrites", () => {
  it("reach the production API only from the production host", () => {
    const toProduction = rewrites.filter(reachesProduction);

    expect(toProduction.length).toBeGreaterThan(0);
    for (const rewrite of toProduction) expect(rewrite, rewrite.source).toSatisfy(isOnlyForProductionHost);
  });

  it("send /api from every other host to the dev API, after the production rules", () => {
    const devIndex = rewrites.findIndex(
      (rewrite) => rewrite.source === "/api/:path*" && rewrite.destination === `${DEV_API}api/:path*` && !rewrite.has,
    );
    const productionIndexes = rewrites.flatMap((rewrite, index) => (reachesProduction(rewrite) ? [index] : []));

    expect(devIndex).toBeGreaterThan(-1);
    for (const index of productionIndexes) expect(index).toBeLessThan(devIndex);
  });
});
