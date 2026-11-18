import {
  API_VERSION,
  createdInvitationSchema,
  SOCKET_PATH,
  type HouseholdEvent,
  type ServerToClientEvents,
} from "@hogar/shared";
import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMember, createHousehold } from "./householdHelpers";
import { request } from "./request";
import { bruno, carla as carlaIdentity, signIn, startTestApi, WEB_ORIGIN, type SignedIn } from "./testApp";

type ClientSocket = Socket<ServerToClientEvents>;
type TestApi = Awaited<ReturnType<typeof startTestApi>>;

let api: TestApi;
let sockets: ClientSocket[] = [];

beforeEach(async () => {
  api = await startTestApi();
});

afterEach(async () => {
  for (const socket of sockets) socket.disconnect();
  sockets = [];
  await api.close();
});

/** A socket the way the web opens one, with whatever handshake the test needs. */
function openSocket(auth: Record<string, unknown>, origin: string | null = WEB_ORIGIN): ClientSocket {
  const socket: ClientSocket = io(api.url, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    auth,
    extraHeaders: origin === null ? {} : { Origin: origin },
    reconnection: false,
    forceNew: true,
  });
  sockets.push(socket);
  return socket;
}

const tokenOf = (person: SignedIn) => person.auth.replace("Bearer ", "");

/** Opens `person`'s socket as the current web does and waits until the server lets it in. */
async function connectAs(person: SignedIn): Promise<ClientSocket> {
  const socket = openSocket({ token: tokenOf(person), apiVersion: API_VERSION });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

/** Resolves when `socket` receives `event`; fails the test if it doesn't arrive within a second. */
function nextEvent(socket: ClientSocket, event: HouseholdEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} never arrived`)), 1000);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Time for anything still in flight to arrive, before asserting that something didn't. Local
 * sockets deliver in well under a millisecond, so a stray event can't slip past this.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

/** Every event `socket` receives from now on, in order. */
function record(socket: ClientSocket): string[] {
  const received: string[] = [];
  socket.onAny((event: string) => received.push(event));
  return received;
}

/** Ana (ADMIN) and Bruno (MEMBER) in Casa Ana. */
async function household() {
  const ana = await signIn(api.app);
  const home = await createHousehold(api.app, ana);
  const brunoMember = await addMember(api.app, home.id, bruno, "MEMBER");
  return { ana, home, bruno: brunoMember };
}

/** The code the server refused the handshake with; fails the test if it lets the socket in. */
function refusalOf(socket: ClientSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => reject(new Error("The server let the socket in")));
    socket.once("connect_error", (error) => resolve(error.message));
  });
}

describe("the handshake", () => {
  it("lets a member in with their access token and the current version", async () => {
    const { bruno } = await household();
    await expect(connectAs(bruno)).resolves.toBeDefined();
  });

  it("refuses a missing or invalid token", async () => {
    await household();
    expect(await refusalOf(openSocket({ apiVersion: API_VERSION }))).toBe("auth.token.invalid");
    expect(await refusalOf(openSocket({ token: "not-a-jwt", apiVersion: API_VERSION }))).toBe("auth.token.invalid");
  });

  it("refuses an origin that isn't the web's, or none", async () => {
    const { bruno } = await household();
    const auth = { token: tokenOf(bruno), apiVersion: API_VERSION };
    expect(await refusalOf(openSocket(auth, "https://evil.example"))).toBe("request.forbidden_origin");
    expect(await refusalOf(openSocket(auth, null))).toBe("request.forbidden_origin");
  });

  it("refuses a web older than the API, or one that doesn't say its version", async () => {
    const { bruno } = await household();
    expect(await refusalOf(openSocket({ token: tokenOf(bruno), apiVersion: API_VERSION - 1 }))).toBe("client.outdated");
    expect(await refusalOf(openSocket({ token: tokenOf(bruno) }))).toBe("client.outdated");
  });

  it("trusts the preview origins WEB_PREVIEW_ORIGIN allows, like /api/auth does (ADR 0010)", async () => {
    await api.close();
    api = await startTestApi({ webPreviewOrigin: "https://hogar-*-scope.vercel.app" });
    const { bruno } = await household();
    const preview = openSocket(
      { token: tokenOf(bruno), apiVersion: API_VERSION },
      "https://hogar-abc-scope.vercel.app",
    );
    await new Promise<void>((resolve, reject) => {
      preview.once("connect", resolve);
      preview.once("connect_error", reject);
    });
  });

  it("refuses someone without a household", async () => {
    const dani = await signIn(api.app, bruno);
    expect(await refusalOf(openSocket({ token: tokenOf(dani), apiVersion: API_VERSION }))).toBe("household.not_member");
  });
});

describe("household:changed", () => {
  it("reaches the other members when an admin renames the household", async () => {
    const { ana, bruno } = await household();
    const brunoSocket = await connectAs(bruno);
    const changed = nextEvent(brunoSocket, "household:changed");

    const res = await request(api.app)
      .patch("/api/household")
      .set("Authorization", ana.auth)
      .send({ name: "Nuestra casa" });

    expect(res.status).toBe(200);
    await changed;
  });

  it("never reaches another household", async () => {
    const { ana } = await household();
    const carla = await signIn(api.app, carlaIdentity);
    await createHousehold(api.app, carla, "Piso Carla");
    const carlaSocket = await connectAs(carla);
    const received = record(carlaSocket);

    await request(api.app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Nuestra casa" });
    // One connection delivers in order: had Ana's rename reached Carla, it would arrive before her own.
    const own = nextEvent(carlaSocket, "household:changed");
    await request(api.app).patch("/api/household").set("Authorization", carla.auth).send({ name: "Piso nuevo" });
    await own;

    expect(received).toEqual(["household:changed"]);
  });

  it("announces nothing when a change is refused", async () => {
    const { ana, home, bruno } = await household();
    const brunoSocket = await connectAs(bruno);
    const received = record(brunoSocket);

    await request(api.app)
      .patch(`/api/household/members/${home.myMembershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "MEMBER" })
      .expect(409);
    // In order on one connection: the rename's event arriving alone means the refusal sent none.
    const renamed = nextEvent(brunoSocket, "household:changed");
    await request(api.app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Nuestra casa" });
    await renamed;

    expect(received).toEqual(["household:changed"]);
  });

  it("follows a currency change and a split saved by an admin", async () => {
    const { ana, home, bruno } = await household();
    const brunoSocket = await connectAs(bruno);

    let changed = nextEvent(brunoSocket, "household:changed");
    await request(api.app).patch("/api/household").set("Authorization", ana.auth).send({ currency: "COP" }).expect(200);
    await changed;

    changed = nextEvent(brunoSocket, "household:changed");
    const weights = [
      { membershipId: home.myMembershipId, weight: 2 },
      { membershipId: bruno.membershipId, weight: 1 },
    ];
    await request(api.app).put("/api/household/split").set("Authorization", ana.auth).send({ weights }).expect(200);
    await changed;
  });

  it("follows a role change, to everyone including that person", async () => {
    const { ana, bruno } = await household();
    const anaSocket = await connectAs(ana);
    const brunoSocket = await connectAs(bruno);
    const changed = [nextEvent(anaSocket, "household:changed"), nextEvent(brunoSocket, "household:changed")];

    await request(api.app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "GUEST" })
      .expect(200);

    await Promise.all(changed);
  });

  it("stops reaching someone who leaves, after telling them and those who stay", async () => {
    const { ana, bruno } = await household();
    const anaSocket = await connectAs(ana);
    const brunoSocket = await connectAs(bruno);
    const brunoReceived = record(brunoSocket);
    const left = [nextEvent(anaSocket, "household:changed"), nextEvent(brunoSocket, "household:changed")];

    await request(api.app).post("/api/household/leave").set("Authorization", bruno.auth).expect(204);
    await Promise.all(left);

    const renamed = nextEvent(anaSocket, "household:changed");
    await request(api.app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Nuestra casa" });
    await renamed;
    await settle();
    expect(brunoReceived).toEqual(["household:changed"]);
  });

  it("stops reaching someone an admin removes, after telling them", async () => {
    const { ana, bruno } = await household();
    const anaSocket = await connectAs(ana);
    const brunoSocket = await connectAs(bruno);
    const brunoReceived = record(brunoSocket);
    const removed = [nextEvent(anaSocket, "household:changed"), nextEvent(brunoSocket, "household:changed")];

    await request(api.app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .expect(200);
    await Promise.all(removed);

    const renamed = nextEvent(anaSocket, "household:changed");
    await request(api.app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Nuestra casa" });
    await renamed;
    await settle();
    expect(brunoReceived).toEqual(["household:changed"]);
  });

  it("tells the members when someone joins with an invitation", async () => {
    const { ana } = await household();
    const anaSocket = await connectAs(ana);
    const invitation = createdInvitationSchema.parse(
      (
        await request(api.app)
          .post("/api/household/invitations")
          .set("Authorization", ana.auth)
          .send({ role: "MEMBER" })
      ).body,
    );
    const carla = await signIn(api.app, carlaIdentity);
    const changed = nextEvent(anaSocket, "household:changed");

    await request(api.app)
      .post("/api/invitations/accept")
      .set("Authorization", carla.auth)
      .send({ token: invitation.token })
      .expect(200);

    await changed;
  });
});

describe("shopping:changed", () => {
  const addItem = (who: SignedIn, name: string) =>
    request(api.app).post("/api/household/shopping/items").set("Authorization", who.auth).send({ name });

  it("reaches the other members when someone adds an item", async () => {
    const { ana, bruno } = await household();
    const anaSocket = await connectAs(ana);
    const changed = nextEvent(anaSocket, "shopping:changed");

    await addItem(bruno, "Milk").expect(201);

    await changed;
  });

  it("never reaches another household", async () => {
    const { bruno } = await household();
    const carla = await signIn(api.app, carlaIdentity);
    await createHousehold(api.app, carla, "Piso Carla");
    const carlaSocket = await connectAs(carla);
    const received = record(carlaSocket);

    await addItem(bruno, "Milk").expect(201);
    // One connection delivers in order: had Bruno's item reached Carla, it would arrive before her own.
    const own = nextEvent(carlaSocket, "shopping:changed");
    await addItem(carla, "Bread").expect(201);
    await own;

    expect(received).toEqual(["shopping:changed"]);
  });

  it("announces nothing when an item is refused as already on the list", async () => {
    const { ana, bruno } = await household();
    await addItem(ana, "Milk").expect(201);
    const anaSocket = await connectAs(ana);
    const received = record(anaSocket);

    await addItem(bruno, "milk").expect(409);
    // In order on one connection: the next add's event arriving alone means the refusal sent none.
    const added = nextEvent(anaSocket, "shopping:changed");
    await addItem(bruno, "Bread").expect(201);
    await added;

    expect(received).toEqual(["shopping:changed"]);
  });
});
