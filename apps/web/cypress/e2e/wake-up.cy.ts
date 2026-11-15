import type { BalancesView, HouseholdView } from "@hogar/shared";
import { ana, session } from "../support/e2e";

const household: HouseholdView = {
  id: "household_1",
  name: "Casa Ana",
  currency: "EUR",
  currencyLocked: false,
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [
    {
      id: "m_ana",
      userId: ana.id,
      name: ana.name,
      avatarUrl: null,
      role: "ADMIN",
      weight: 1,
      shareBps: 10000,
      joinedAt: "2026-11-10T10:00:00.000Z",
    },
  ],
  splitNeedsReview: false,
};

const square: BalancesView = {
  balances: [{ person: { userId: ana.id, name: ana.name, avatarUrl: null, former: false }, balanceCents: 0 }],
  suggestions: [],
  myBalanceCents: 0,
};

/** The health check answers 503 (a proxy page while the server boots) until `wakeAfter` calls have been made. */
function sleepingServer(wakeAfter: number) {
  let calls = 0;
  cy.intercept("GET", "/api/health", (req) => {
    calls += 1;
    if (calls > wakeAfter) req.reply({ statusCode: 200, body: { status: "ok" } });
    else req.reply({ statusCode: 503, body: "<html>Service starting</html>" });
  }).as("health");
}

/** The parts of the fake clock (`@sinonjs/fake-timers`) that `cy.clock()` installs on the page's timers. */
interface FakeClock {
  timers?: Record<string, { type: string; delay?: number }>;
}

/**
 * Waits until the app has scheduled a one-off timer of `delayMs`, so the next `cy.tick` fires it.
 * Replies reach the app in real time while its clock is fake: moving the clock before the app has
 * handled a reply would skip the timer it is about to schedule.
 */
function timerScheduled(delayMs: number) {
  cy.window().should((win) => {
    const { clock } = win.setTimeout as typeof win.setTimeout & { clock?: FakeClock };
    const timers = Object.values(clock?.timers ?? {});
    expect(
      timers.some((timer) => timer.type === "Timeout" && timer.delay === delayMs),
      `a ${delayMs} ms timer is scheduled`,
    ).to.equal(true);
  });
}

describe("Waking up the server", () => {
  it("keeps a signed-in member on their page through a long wake-up", () => {
    // The server sleeps until the test wakes it at 16 s. (Counting calls would be off by one in
    // dev, where StrictMode mounts the provider twice and the first check is cancelled.)
    let healthy = false;
    let refreshedBeforeHealthy = false;
    cy.intercept("GET", "/api/health", (req) => {
      req.reply(healthy ? { statusCode: 200, body: { status: "ok" } } : { statusCode: 503, body: "starting" });
    }).as("health");
    cy.intercept("POST", "/api/auth/refresh", (req) => {
      if (!healthy) refreshedBeforeHealthy = true;
      req.reply(session());
    }).as("refresh");
    cy.intercept("GET", "/api/household", { body: { household, removedFrom: null } });
    cy.intercept("GET", "/api/household/balances", square);

    // The fake clock moves one retry (2 s) at a time, once the app has handled the failed check
    // and scheduled the next one.
    const settle = () => {
      cy.wait("@health");
      timerScheduled(2000);
    };
    const nextCheck = () => {
      cy.tick(2000);
      settle();
    };

    cy.clock();
    cy.visit("/balances");
    settle();
    cy.tick(1000);
    cy.findHeading("Knocking on your home's door…");
    cy.contains("Hogar takes a nap when nobody's around");
    cy.contains("Invite the people you live with by sharing a link. No emails needed.");

    cy.tick(1000);
    settle(); // 2 s
    nextCheck(); // 4 s
    nextCheck(); // 6 s
    nextCheck(); // 8 s: the second tip
    cy.contains("Invite the people you live with by sharing a link. No emails needed.").should("not.exist");
    cy.contains("Give each person a weight");
    nextCheck(); // 10 s
    nextCheck(); // 12 s
    nextCheck(); // 14 s
    cy.tick(1000); // 15 s
    cy.findHeading("Turning on the lights…");
    cy.then(() => {
      healthy = true;
    });
    cy.tick(1000); // 16 s: awake
    cy.wait("@refresh");
    cy.findHeading("Balances");
    cy.location("pathname").should("eq", "/balances");
    cy.get("@refresh.all").should("have.length", 1);
    cy.wrap(null).then(() => expect(refreshedBeforeHealthy, "refreshed before the server answered").to.equal(false));
  });

  it("offers to try again when waking takes too long", () => {
    sleepingServer(Number.POSITIVE_INFINITY);
    cy.clock();
    cy.visit("/");
    cy.wait("@health");
    for (let second = 0; second < 90; second += 2) cy.tick(2000);
    cy.findHeading("This is taking longer than usual");

    sleepingServer(0);
    cy.contains("button", "Try again").click();
    // The scene stays at least 500 ms before leaving for the sign-in page.
    cy.wait(["@health", "@refresh"]);
    timerScheduled(500);
    cy.tick(500);
    cy.location("pathname").should("eq", "/login");
    cy.findHeading("Welcome to Hogar");
  });
});
