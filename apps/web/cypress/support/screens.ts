import type {
  ActivityPage,
  BalancesView,
  CategoryView,
  ExpenseView,
  HouseholdView,
  InvitationPreview,
  InvitationView,
  Locale,
  MemberView,
  PersonRef,
  ShoppingItemView,
} from "@hogar/shared";
import { LANGUAGE_STORAGE_KEY } from "../../src/i18n";
import { THEME_STORAGE_KEY, type Theme } from "../../src/theme/theme";
import { ana, categoryView, session } from "./e2e";

/**
 * A full household whose names and amounts are deliberately long (pesos have no decimals, so
 * amounts run to seven digits), so every signed-in screen shows its widest realistic content.
 * Shared by the 320 px guard and the small-screen captures.
 */

const member = (id: string, userId: string, name: string, role: MemberView["role"], weight: number): MemberView => ({
  id,
  userId,
  name,
  avatarUrl: null,
  role,
  weight,
  shareBps: 0,
  joinedAt: "2026-11-10T10:00:00.000Z",
});

export const BRUNO = "Bruno Fernández de la Torre";
export const CARLA = "Carla Valentina Ruiz Ortega";

export const household: HouseholdView = {
  id: "household_1",
  name: "Piso compartido de la calle Mayor",
  currency: "COP",
  currencyLocked: true,
  myMembershipId: "m_ana",
  myRole: "ADMIN",
  members: [
    { ...member("m_ana", ana.id, ana.name, "ADMIN", 2), shareBps: 5000 },
    { ...member("m_bruno", "user_bruno", BRUNO, "ADMIN", 1), shareBps: 2500 },
    { ...member("m_carla", "user_carla", CARLA, "GUEST", 1), shareBps: 2500 },
  ],
  splitNeedsReview: false,
  showWhoAsked: true,
};

const ref = (userId: string, name: string): PersonRef => ({ userId, name, avatarUrl: null, former: false });
const anaRef = ref(ana.id, ana.name);
const brunoRef = ref("user_bruno", BRUNO);
const carlaRef = ref("user_carla", CARLA);

export const balances: BalancesView = {
  balances: [
    { person: anaRef, balanceCents: 1_070_500 },
    { person: brunoRef, balanceCents: -1_520_000 },
    { person: carlaRef, balanceCents: 449_500 },
  ],
  suggestions: [
    { from: brunoRef, to: anaRef, amountCents: 1_070_500 },
    { from: brunoRef, to: carlaRef, amountCents: 449_500 },
  ],
  myBalanceCents: 1_070_500,
};

/** Leisure follows the household's split; Rent has its own, so moving an expense there asks first. */
const leisure = categoryView({ id: "cat_leisure", name: "Ocio y salidas", emoji: "🎉", position: 2 });
const rent: CategoryView = categoryView({
  id: "cat_rent",
  name: "Alquiler y gastos de comunidad",
  emoji: "🏠",
  position: 1,
  ownSplit: true,
  version: 2,
  expenseCount: 12,
  weights: [
    { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 3334 },
    { membershipId: "m_bruno", userId: "user_bruno", weight: 1, shareBps: 3333 },
    { membershipId: "m_carla", userId: "user_carla", weight: 1, shareBps: 3333 },
  ],
});
export const categories: CategoryView[] = [rent, leisure];

export const expense: ExpenseView = {
  id: "expense_1",
  description: "Compra semanal del supermercado y la farmacia",
  amountCents: 1_284_000,
  date: "2026-11-10",
  paidBy: anaRef,
  split: {
    method: "WEIGHTS",
    shares: [
      { person: anaRef, amountCents: 642_000 },
      { person: brunoRef, amountCents: 321_000 },
      { person: carlaRef, amountCents: 321_000 },
    ],
  },
  createdBy: anaRef,
  createdAt: "2026-11-10T10:00:00.000Z",
  editedBy: brunoRef,
  editedAt: "2026-11-11T09:30:00.000Z",
  version: 2,
  category: { id: leisure.id, name: leisure.name, emoji: leisure.emoji },
};

export const activity: ActivityPage = {
  items: [
    {
      kind: "expense",
      id: expense.id,
      description: expense.description,
      amountCents: expense.amountCents,
      date: expense.date,
      paidBy: anaRef,
      viewerPart: { kind: "lent", amountCents: 642_000 },
      category: expense.category,
      deleted: null,
    },
    {
      kind: "settlement",
      id: "settlement_1",
      amountCents: 449_500,
      date: "2026-11-09",
      from: brunoRef,
      to: carlaRef,
      deleted: null,
    },
  ],
  nextCursor: null,
};

/** Names and notes at their longest (50 and 100 characters), asked for by the longest names. */
export const shoppingItems: ShoppingItemView[] = [
  {
    id: "item_1",
    name: "Detergente líquido para ropa delicada, sin perfume",
    note: "El de la botella azul grande, que no sea el concentrado porque mancha la ropa oscura, ni el de marca",
    askedBy: brunoRef,
    addedAt: "2026-11-18T10:00:00.000Z",
    version: 1,
  },
  {
    id: "item_2",
    name: "Leche",
    note: "sin lactosa",
    askedBy: carlaRef,
    addedAt: "2026-11-18T10:01:00.000Z",
    version: 1,
  },
  { id: "item_3", name: "Pan", note: null, askedBy: anaRef, addedAt: "2026-11-18T10:02:00.000Z", version: 1 },
];

export const invitationPreview: InvitationPreview = {
  householdName: household.name,
  inviterName: ana.name,
  role: "MEMBER",
  expiresAt: "2026-11-20T22:00:00.000Z",
  viewer: "can_join",
};

/** Stubs every endpoint the signed-in screens read, for a signed-in Ana in `household`. */
export function stubSignedIn(locale: Locale) {
  cy.intercept("POST", "/api/auth/refresh", session({ ...ana, locale }));
  cy.intercept("GET", "/api/household", { body: { household } });
  cy.intercept("GET", "/api/household/balances", balances);
  cy.intercept("GET", "/api/household/activity*", activity);
  cy.intercept("GET", "/api/household/categories", { body: { categories } });
  cy.intercept("GET", "/api/household/shopping", { body: { items: shoppingItems } });
  cy.intercept("GET", "/api/household/expenses/expense_1", { body: { expense } });
  cy.intercept("GET", "/api/household/invitations", { body: { invitations: [invitation("inv_1")] } });
  cy.intercept("POST", "/api/invitations/lookup", invitationPreview);
}

/** A pending member invitation Ana created. */
export function invitation(id: string): InvitationView {
  return { id, role: "MEMBER", createdByName: ana.name, expiresAt: "2026-11-20T22:00:00.000Z", status: "pending" };
}

/** Every main signed-in page, as a path the router serves. */
export const signedInPages = [
  "/",
  "/expenses",
  "/expenses/new",
  "/expenses/expense_1",
  "/expenses/expense_1/edit",
  "/balances",
  "/shopping",
  "/household/settings",
  "/invite#tok_join",
] as const;

interface VisitOptions {
  locale: Locale;
  theme?: Theme;
  /** `wake-up` stops at the screen shown while the server wakes, instead of the page behind it. */
  until?: "page" | "wake-up";
  /** The browser's text size setting: 2 is 200 %. */
  textZoom?: number;
}

/** Opens `path` with a stored language and theme, as a returning person would, ready to measure. */
export function visitIn(path: string, { locale, theme = "light", until = "page", textZoom = 1 }: VisitOptions) {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
      win.localStorage.setItem(THEME_STORAGE_KEY, theme);
    },
  });
  if (until === "wake-up") {
    // The wake-up screen's status is its h1.
    cy.get("[role=status] h1", { timeout: 10_000 }).should("be.visible");
  } else {
    // Every page names itself with one main heading; the wake-up screen's h1 is not the page's.
    cy.get("h1", { timeout: 10_000 }).should(($headings) => {
      expect($headings.filter((_, heading) => !heading.closest("[role=status]"))).to.have.length(1);
    });
    // ...and nothing is still loading: a spinner is a status named after what it waits for.
    cy.get("[role=status][aria-label]", { timeout: 10_000 }).should("not.exist");
  }
  // Measure with Figtree, not the fallback font it swaps in for while loading.
  cy.document().its("fonts.status").should("equal", "loaded");
  cy.document().then((doc) => {
    const style = doc.createElement("style");
    // Phones draw scrollbars over the content; Electron's classic one would steal 15 px of the 320.
    // A browser's text size setting scales the root font size, which every rem token follows.
    style.textContent = `html { scrollbar-width: none; font-size: ${textZoom * 100}%; }`;
    doc.head.append(style);
  });
}

/** Fails if the page scrolls sideways: the document must be no wider than the viewport (WCAG 1.4.10). */
export function assertNoHorizontalScroll() {
  cy.document().should((doc) => {
    const { scrollWidth, clientWidth } = doc.documentElement;
    expect(scrollWidth, `document width vs viewport; sticking out: ${overflowing(doc, clientWidth)}`).to.be.at.most(
      clientWidth,
    );
  });
}

/** The innermost elements whose right edge passes the viewport, so a failure points at the culprit. */
function overflowing(doc: Document, viewportWidth: number): string {
  const culprits = [...doc.body.querySelectorAll("*")].filter(
    (element) =>
      element.getBoundingClientRect().right > viewportWidth &&
      ![...element.children].some((child) => child.getBoundingClientRect().right > viewportWidth),
  );
  return (
    culprits
      .slice(0, 5)
      .map((element) => `<${element.tagName.toLowerCase()} class="${element.className}">`)
      .join(", ") || "none"
  );
}

const TOUCH_TARGETS = [
  "a[href]",
  "button",
  "select",
  "textarea",
  'input:not([type="hidden"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="combobox"]',
].join(", ");

/** 44 px and `--space-2`, from rule 5 of "Small screens" in docs/design.md. */
const MIN_TARGET_PX = 44;
const MIN_GAP_PX = 8;

/**
 * Rule 5 of "Small screens": every touch target on the page is at least 44 px tall and at least
 * `--space-2` away from its neighbours. A checkbox or radio counts as its whole label, which is
 * what a finger presses; visually hidden controls and the skip link (off screen until focused)
 * aren't targets. Page content scrolling under something fixed (the tab bar) isn't its
 * neighbour, but fixed things are measured against each other (the tab bar and a floating button).
 */
export function assertTouchTargets() {
  cy.document().should((doc) => {
    const targets = new Map<Element, DOMRect>();
    for (const control of doc.querySelectorAll(TOUCH_TARGETS)) {
      const target = control.closest("label") ?? control;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1 || rect.bottom <= 0) continue;
      if ([...targets.keys()].some((other) => other.contains(target))) continue;
      for (const inner of [...targets.keys()]) if (target.contains(inner)) targets.delete(inner);
      targets.set(target, rect);
    }
    const entries = [...targets];
    const small = entries
      .filter(([, rect]) => rect.height < MIN_TARGET_PX - 0.5)
      .map(([target]) => describeTarget(target));
    expect(small, "touch targets under 44 px tall").to.deep.equal([]);
    const crowded: string[] = [];
    const fixed = new Map(entries.map(([target]) => [target, isFixed(target)]));
    entries.forEach(([a, rectA], index) => {
      for (const [b, rectB] of entries.slice(index + 1)) {
        const gapX = Math.max(rectB.left - rectA.right, rectA.left - rectB.right);
        const gapY = Math.max(rectB.top - rectA.bottom, rectA.top - rectB.bottom);
        if (fixed.get(a) !== fixed.get(b)) continue;
        if (Math.max(gapX, gapY) < MIN_GAP_PX - 0.5) crowded.push(`${describeTarget(a)} ↔ ${describeTarget(b)}`);
      }
    });
    expect(crowded, "touch targets closer than --space-2").to.deep.equal([]);
  });
}

/** Whether a target stays put while the page scrolls (inside the tab bar or a floating button). */
function isFixed(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (getComputedStyle(current).position === "fixed") return true;
  }
  return false;
}

function describeTarget(element: Element): string {
  const name = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 30) ?? "";
  return `<${element.tagName.toLowerCase()}> "${name}"`;
}

/** Where an element is on screen, for layout checks. */
export function rectOf($element: JQuery<HTMLElement>): DOMRect {
  const element = $element.get(0);
  if (!element) throw new Error("Nothing to measure");
  return element.getBoundingClientRect();
}
