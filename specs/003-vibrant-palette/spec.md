# Feature Specification: Vibrant palette, a joyful fuchsia identity

**Feature Branch**: `feat/vibrant-palette`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Change the design system to more striking colors. Our current colors look too much like Anthropic's and Claude's. I'm after a younger look, similar to how the N26 team handles color, but with a more striking pink, a mix between Barbie pink and the Pink Panther." Constitution 3.0.0 has already redefined Principle VI from "warmth and comfort" to "joyful and approachable", so this feature brings the visual system, the design guide and the docs in line with it.

## Clarifications

### Session 2026-11-11 (grill-me interview)

- Q: How much of the palette changes? → A: All of it, N26 style: fuchsia is the only brand color, set against clean neutrals. Backgrounds, borders, shadows and dark mode all change; no sand, terracotta or brown remains.
- Q: Which pink? → A: A vivid fuchsia, closer to Barbie than to the Pink Panther. It is used as is wherever no text sits on it. Text-bearing surfaces get a deeper shade of the same hue so that text stays readable.
- Q: How loud is it? → A: Used deliberately: the primary action, focus, brand moments and one highlighted surface. Everything else stays neutral and calm.
- Q: Where does the vivid tone itself appear? → A: Logo and favicon, focus ring, illustrations and empty states, and the primary buttons in the dark theme (with dark text on top).
- Q: Large fuchsia surfaces? → A: Only the money card on the home page.
- Q: How does the money card show "you're owed" vs "you owe" on fuchsia? → A: The sentence in white, with a decorative direction icon (incoming/outgoing) next to it; the words carry the meaning. The primary action on the card is inverted (white with fuchsia text) and secondary actions are outlined in white.
- Q: State colors? → A: Redesigned to match: positive ("owes you", done) in a fresh teal/mint, negative ("you owe", error) in orange-coral so it can never be mistaken for the brand pink, and a cleaner amber for warnings.
- Q: Member colors? → A: Eight colors recalculated with equal luminance and no pink or magenta hue, so no member looks like the brand or like a debt.
- Q: Secondary actions? → A: Neutral (white or light grey with dark text). Only the primary action is fuchsia.
- Q: Light theme background? → A: Off-white with a hint of pink for the page, pure white for cards and panels.
- Q: Dark theme? → A: Near-black with a plum tint; surfaces and borders in the same family.
- Q: Logo? → A: Same shape, recolored to the vivid fuchsia everywhere it appears (app, favicon, Storybook).
- Q: Typography and shape? → A: Unchanged. Same typeface, radii, spacing and shadow scale; only the shadow tint moves from brown to neutral/plum.
- Q: Evidence? → A: Before/after screenshots of the key screens in both themes, attached to the pull request and to the new decision record. No automated visual regression.

### Design review 2026-11-11

- Q: Did the vivid tone stay at the interview's `#E6197F`? → A: No, it moved to `#EB2386`. With dark text on dark-theme buttons the original reached 4.31:1, below AA; the new value reaches 4.59:1 and looks practically the same (FR-002, FR-011).
- Q: Are the member colors only equal in luminance? → A: Equal in luminance and in saturation. The first set had a saturated teal next to a soft lavender, which broke visual fairness on the home page, so all eight were refitted (FR-009).
- Q: Did anything outside color have to change? → A: One bug fix. Pure white surfaces crashed the Color docs page in the production build, because built CSS shortens `#ffffff` to `#fff` and the contrast helper only read six digits. Fixed with a test.
- Q: What was checked, and how? → A: Home, balances, expense form and login in both themes from the capture screenshots; the Card brand story and the Color page in Storybook (both themes, Spanish and English); the design guide checklist; no old-palette references left (SC-002); all automated checks green (SC-001, SC-004, SC-007). SC-006 was judged by eye from the before/after pairs in ADR 0004.
- Q: What was not checked in a real browser? → A: Forced-colors mode and the mobile browser bar on a physical phone. The card has a forced-colors border rule and the bar color is covered by a unit test, but neither was looked at on a device.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The app feels new in the light theme (Priority: P1)

A household member opens Hogar in the light theme and sees a young, joyful identity: an off-white page, white cards, fuchsia primary actions and nothing left of the old sand and terracotta look. Debts, errors and warnings remain easy to tell apart, and none of them can be mistaken for the brand color.

**Why this priority**: The light theme is the default and the first thing anyone sees, including recruiters reviewing the portfolio. It is the core of the request: stop looking like Anthropic/Claude.

**Independent Test**: Open every existing screen in the light theme. Check that the only brand color is fuchsia, that each screen has at most one fuchsia primary action per block, and that "you owe", "owes you" and warning states read clearly through both color and words.

**Acceptance Scenarios**:

1. **Given** a signed-in member on any screen in the light theme, **When** the screen loads, **Then** the page background is off-white with a hint of pink, cards are white, and the primary action is fuchsia with readable white text.
2. **Given** the balances page with one debt and one credit, **When** the member reads it, **Then** the debt is shown in orange-coral and the credit in teal, each with its sentence ("You owe…", "Ana owes you…"), and neither uses the brand pink.
3. **Given** a form with a validation error, **When** the error appears, **Then** it uses the negative (coral) style and explains itself in words, never in a pink that could be read as a brand highlight.
4. **Given** a screen with secondary actions (Cancel, menu, links to other pages), **When** it is displayed, **Then** those actions are neutral and only the primary action is fuchsia.
5. **Given** a household with up to eight members, **When** their avatars are shown, **Then** each member has a distinct color, none is pink or magenta, and all look equally prominent.

---

### User Story 2 - The money card is the brand moment (Priority: P2)

On the home page, the member's money summary appears as a fuchsia card. It states their balance in white ("You're owed €10.70 in total") with a small direction icon, and offers its actions in colors that stand out on the fuchsia.

**Why this priority**: This is the single large splash of brand color that gives the app its personality, in the place people look most. It depends on the palette from US1.

**Independent Test**: Open the home page as a member who owes money, one who is owed, one who is all square, a guest without the add action, and with balances still loading or failing to load. Check that the card stays readable in every state.

**Acceptance Scenarios**:

1. **Given** a member who is owed money, **When** they open the home page, **Then** the money card is fuchsia, the sentence "You're owed €X in total" is white and readable, and an incoming-direction icon accompanies it.
2. **Given** a member who owes money, **When** they open the home page, **Then** the sentence "You owe €X in total" is white with an outgoing-direction icon; the meaning is clear from the words alone.
3. **Given** a member who is all square, **When** they open the home page, **Then** the card shows the all-square sentence with no direction icon.
4. **Given** a member who can add expenses, **When** the card is shown, **Then** the "Add expense" action is white with fuchsia text and the other links are outlined in white, all with a visible focus indicator on the fuchsia.
5. **Given** balances that are loading or failed to load, **When** the card is shown, **Then** the loading indicator and the error message are readable on the fuchsia.

---

### User Story 3 - The dark theme matches (Priority: P3)

A member who uses the dark theme sees a plum-tinted near-black background, surfaces in the same family and vivid fuchsia primary buttons with dark text, with the same clarity for states and members as in the light theme.

**Why this priority**: Both themes are first-class under the constitution, but the dark theme is used less and follows directly from the decisions in US1 and US2.

**Independent Test**: Switch to the dark theme and repeat the US1 and US2 checks.

**Acceptance Scenarios**:

1. **Given** the dark theme, **When** any screen loads, **Then** the background is a plum-tinted near-black and nothing brown remains.
2. **Given** the dark theme, **When** a primary action is shown, **Then** it is the vivid fuchsia with dark, readable text.
3. **Given** the dark theme on the home page, **When** the money card is shown, **Then** it is still a fuchsia brand surface with readable text and actions.
4. **Given** the dark theme on the balances page, **When** debts and credits are shown, **Then** coral and teal remain distinguishable from each other and from the brand color.

---

### User Story 4 - The brand is consistent beyond the app screens (Priority: P4)

Anyone who meets Hogar outside its screens sees the same identity: the browser tab icon, the logo, the browser bar color on mobile, and the design system's living documentation (its chrome, color foundations and component pages). The design guide and a new decision record explain the new direction and why it was chosen.

**Why this priority**: The constitution requires the brand everywhere, Storybook included, and a portfolio is judged on its documented reasoning. It does not change how the app works, so it comes last.

**Independent Test**: Check the favicon, the logo and the mobile browser bar color in both themes. Browse the design system documentation in both themes and both languages. Read the design guide and the new decision record.

**Acceptance Scenarios**:

1. **Given** the app open in a browser, **When** the person looks at the tab, **Then** the favicon is the same Hogar mark in vivid fuchsia.
2. **Given** the design system documentation, **When** it is opened in either theme, **Then** its chrome, docs pages and component previews use the new palette, with no sand, terracotta or brown.
3. **Given** the color foundations page, **When** it is read in English or Spanish, **Then** it presents the new palette and explains, in each language, why each color exists and how it helps the person.
4. **Given** the design guide, **When** a contributor reads it, **Then** its emotional goal, principles and color rules describe the "joyful and approachable" direction (one joyful color used deliberately, coral rather than red for debts) and no longer mention the warm palette.
5. **Given** the decision records, **When** a reviewer reads them, **Then** a new record explains the change of palette, links to before/after screenshots and supersedes the palette part of the original visual system record.

---

### Edge Cases

- A negative (coral) amount shown next to a fuchsia primary button: the two are clearly different hues and the amount also carries its sentence.
- The focus indicator on a fuchsia button or on the fuchsia money card stays visible against the fuchsia itself.
- Selected text in both themes stays readable.
- A household with eight members: all eight colors are distinct, equally prominent and none is pink.
- Forced-colors / high-contrast modes: buttons, the money card and focus indicators stay usable when the system replaces colors.
- Reduced motion: unaffected, since no animation changes.
- Spanish text, about 30 % longer, on the money card's inverted and outlined actions: it wraps without clipping.
- A guest on the home page: the money card has no add action and still looks complete.
- Former members shown in history: they keep a member color from the new set.

## Requirements _(mandatory)_

### Functional Requirements

**Brand and neutrals**

- **FR-001**: The interface MUST use a single brand color, a vivid fuchsia, plus neutrals. No sand, terracotta, brown or other warm-earth tone may remain in the app, the logo or the design system documentation.
- **FR-002**: The vivid fuchsia MUST be used as is only where no small text sits on it (logo, favicon, focus indicator, illustrations, empty-state art) and as the dark theme's primary action background with dark text. Wherever white text sits on the brand color, a deeper shade of the same hue MUST be used.
- **FR-003**: In the light theme, the page background MUST be an off-white with a slight pink tint, and cards and panels MUST be white.
- **FR-004**: In the dark theme, backgrounds, surfaces and borders MUST be near-black with a plum tint, with no brown.
- **FR-005**: Shadows MUST keep their current scale and switch from a brown tint to a neutral/plum tint.

**Hierarchy**

- **FR-006**: Only primary actions use the brand color; secondary actions MUST be neutral. There is at most one primary action per screen or block, as today.
- **FR-007**: The home page money card MUST be the only large brand-colored surface. On it, the balance sentence MUST be white and accompanied by a decorative direction icon (incoming when owed, outgoing when owing, none when all square). The primary action MUST be inverted (white with brand text) and secondary actions outlined in white. Its loading and error states MUST stay readable on the brand surface.

**States and members**

- **FR-008**: Positive states ("owes you", done, confirmation) MUST use a teal/mint, negative states ("you owe", error, destructive action) an orange-coral, and warnings an amber, in both themes. None of them may be confused with the brand fuchsia.
- **FR-009**: The eight member colors MUST share the same luminance within each theme, MUST be distinct from each other, and MUST NOT use a pink or magenta hue.
- **FR-010**: Color MUST never be the only carrier of meaning: every state keeps its words, icon or sign.

**Accessibility**

- **FR-011**: Every text/background pair and every UI border used by the interface, including those on the money card, MUST meet WCAG AA contrast in both themes.
- **FR-012**: The focus indicator MUST be clearly visible on every background used, including fuchsia buttons and the fuchsia money card.

**Scope guards**

- **FR-013**: Typeface, type scale, radii, spacing, layout and motion MUST NOT change, except the direction icon beside the money card's balance sentence (FR-007).
- **FR-014**: No user-facing copy in the app changes. The direction icon is decorative and adds no text. Only the documentation prose that describes the palette changes, in both English and Spanish.

**Brand assets and documentation**

- **FR-015**: The logo and favicon MUST keep their shape and use the vivid fuchsia wherever they appear: the app, the browser tab and the design system documentation. The mobile browser bar color MUST match the new palette in each theme.
- **FR-016**: The design system documentation (chrome, docs pages, component previews) MUST use the new palette in both themes. The color foundations page, the introduction and every component page that describes the old palette or "warmth" MUST be rewritten in both languages to explain the new palette and how it helps the person.
- **FR-017**: The design guide MUST be updated: emotional goal ("joyful and approachable"), principles table ("one joyful color, used deliberately" replacing "nothing shouts" and "warmth over neutrality"), color rules (fuchsia for the primary action, coral rather than red for debts, the money card as the single brand surface), and the style-check guard with the new palette's names. The project's day-to-day guidance and its README MUST drop their references to "warmth" so it does not contradict the constitution.
- **FR-018**: A new decision record MUST explain the move from the warm palette to the vibrant one (context: resemblance to Anthropic/Claude, new constitutional goal), MUST supersede the palette part of the original visual system record, and MUST link before/after screenshots of the key screens (home, balances, expense form, login) in both themes. The original record MUST point to the new one.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100 % of the interface's text/background and UI-border pairs meet WCAG AA in both themes (0 failures in the automated contrast check).
- **SC-002**: 0 references to the old palette (sand, terracotta, brown/earth, sage, brick) remain in the app's styles, the logo files or the design system documentation.
- **SC-003**: Every existing screen and every design system component has been reviewed in both themes against the design guide checklist, with 0 open findings.
- **SC-004**: Every existing automated check (unit, accessibility, end-to-end, formatting, linting, type checking, builds) passes with no test weakened or skipped.
- **SC-005**: Before/after screenshots exist for at least 4 key screens × 2 themes (8 pairs), linked from the pull request and the decision record.
- **SC-006**: Side by side with Anthropic's and Claude's interfaces, the main screens share no dominant hue: the brand fuchsia, the neutrals and the dark background are all visibly different from their terracotta/cream/brown family.
- **SC-007**: Both languages have the same documentation content for the palette (the existing locale-parity checks stay green).

## Assumptions

- Constitution 3.0.0 (Principle VI, "Joyful and Accessible Design") is in force; no further amendment is needed.
- Reference values, AA-verified during planning: brand fuchsia #EB2386 (moved from the interview's #E6197F so dark-theme buttons with dark text meet AA); text-bearing brand shade #C2126A; soft brand tint #FDE8F2; light page #FBF8FA with white cards; dark background #141016; positive #0F6F68 / #5FD6C2; negative #B8400F / #FF9E6B (light / dark). The full palette is in research.md R3.
- "N26 style" means clean neutrals with one confident brand color. N26's actual colors, logo and assets are not copied.
- The existing contrast checks, the theme parity checks and the documentation's theme sync check stay the safety net for the new values.
- No new screens, features or user-selectable themes; the existing light/dark switching is unchanged.
- No new tooling: screenshots are taken with the existing local setup.
- Out of scope: a new logo shape, a new typeface, shape or layout changes, automated visual regression testing, marketing pages.
