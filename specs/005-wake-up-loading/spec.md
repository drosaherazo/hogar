# Feature Specification: Wake-up loading screen

**Feature Branch**: `feat/wake-up-loading`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Because of how long Render takes to start again once it has gone to sleep, we're going to make a loading screen that keeps the user a bit entertained. A centered spinner is rather archaic and provides no information at all." (Original in Spanish: "debido al tiempo que se demora render en volver a iniciar una vez esté dormida, vamos a hacer una pantalla de carga que entretenga un poco al usuario. Un spinner centrado es bastante arcaíco y no probee nada de información".)

## Context

Hogar's server runs on a free plan that goes to sleep after about 15 minutes without traffic; the first visit after that takes 30–50 seconds while it starts again (see `docs/deploy.md`). Every visit begins by checking whether the person is already signed in, so that wait always lands on the very first screen. Today that screen is a centered spinner with the words "Loading your home…": it doesn't say why it is slow, how long it will take or whether anything is happening, and if the check gives up while the server is still starting, a signed-in person can end up on the login page as if they had been signed out.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A returning member knows what is happening and gets in (Priority: P1)

A signed-in member opens Hogar after a quiet afternoon. Instead of a bare spinner, they see a friendly screen saying that their home is waking up and that it usually takes under a minute, with visible signs that it is moving forward. When the server is ready, they land on the page they opened, still signed in, without doing anything.

**Why this priority**: This is the core of the request: turn an unexplained wait into an understood one, and make sure the wait never ends on the wrong screen. It is valuable on its own even without any entertainment content.

**Independent Test**: With the server answering only after 45 seconds, open the app as a signed-in member on a deep link (for example an expense detail). Check that the screen explains the wait within a second of appearing, that its message moves through stages as time passes, and that the member ends up on the expense detail page, not on the login page.

**Acceptance Scenarios**:

1. **Given** a signed-in member and a sleeping server, **When** they open the app, **Then** they see a screen that says, in plain words, that their home is waking up and that this usually takes under a minute.
2. **Given** the wake-up screen is showing, **When** time passes, **Then** its status message advances through a short sequence of stages (for example "Knocking on the door…", "Turning on the lights…", "Almost there…") so the person can tell it has not frozen; no stage claims a precise percentage of progress.
3. **Given** the server takes 45 seconds to answer, **When** it finally answers that the member is signed in, **Then** the member lands on the page they originally opened, signed in.
4. **Given** the server is still starting and its first attempts fail or time out, **When** the app keeps waiting, **Then** it retries on its own and never sends a signed-in member to the login page because the server was asleep.
5. **Given** a visitor who is not signed in, **When** the server wakes up and confirms there is no session, **Then** they are taken to the login page as today.

---

### User Story 2 - The wait is pleasant, not empty (Priority: P2)

While the home wakes up, the member sees a lively on-brand illustration of a house coming to life and a rotating set of short, friendly tips about Hogar ("Tap a balance to settle up in one step", "Splits follow each member's weight, so they always add up to the cent"). The wait feels like a moment with the app rather than dead time.

**Why this priority**: It is what makes the screen "entertaining" and joyful (Principle VI), but it only makes sense once Story 1 is in place.

**Independent Test**: Keep the server asleep for 60 seconds and watch the screen. Check that tips change at a readable pace without repeating, that the illustration is animated, and that with reduced motion turned on the illustration is still and tips change without animated transitions.

**Acceptance Scenarios**:

1. **Given** the wake-up screen is showing, **When** a tip appears, **Then** it stays on screen long enough to read comfortably (at least 6 seconds) before the next one replaces it.
2. **Given** a wait of up to 60 seconds, **When** the member watches the screen, **Then** no tip is shown twice.
3. **Given** the person's device asks for reduced motion, **When** the wake-up screen shows, **Then** the illustration does not move continuously and tips swap without sliding or fading animations.
4. **Given** the person uses a screen reader, **When** the wake-up screen shows, **Then** they hear what is happening once and again at each stage change, but tips are not read out every time they rotate.
5. **Given** either the light or the dark theme, **When** the screen shows, **Then** all text meets AA contrast and the brand palette is used as the design guide describes.

---

### User Story 3 - A wait that goes wrong ends with a way forward (Priority: P3)

Sometimes the wait is longer than usual, or the device is offline. Instead of an endless animation, the member is told plainly what is going on and has a clear way to try again.

**Why this priority**: Rare, but an endless spinner is exactly the frustration this feature removes; it also completes the honest-status promise of Story 1.

**Independent Test**: Keep the server unreachable for more than 90 seconds and check that a "taking longer than usual" message with a retry action appears. Separately, switch the device offline before opening the app and check that the screen says so and continues on its own once the connection is back.

**Acceptance Scenarios**:

1. **Given** the server has not answered after 90 seconds, **When** that limit passes, **Then** the screen says that this is taking longer than usual, without blaming the person, and offers a "Try again" action.
2. **Given** the "taking longer than usual" message, **When** the member chooses "Try again", **Then** the wait starts over with the normal wake-up screen.
3. **Given** the device is offline, **When** the app opens, **Then** the screen says the device seems to be offline instead of saying the home is waking up, and it continues on its own as soon as the connection returns.

---

### Edge Cases

- **Server already awake**: the answer arrives almost immediately; the wake-up content must not flash on screen for a fraction of a second.
- **Answer arrives just after the screen appears**: once the wake-up content is visible it stays long enough not to look like a flicker before moving on.
- **Server awake but the session has expired**: the person goes to the login page as today; the wake-up screen does not interfere.
- **Invitation links and other deep links**: the destination, including any `#fragment`, survives the wait.
- **Very long waits (beyond the tip set)**: after the 90-second limit the retry state takes over, so tips never need to loop endlessly.
- **Tab in the background**: if the person switches tabs and comes back, the screen shows the current state, not a backlog of stage changes.
- **Language**: the screen appears before the account's language is known, so it uses the stored preference or the browser language, like the rest of the app before sign-in.
- **Narrow phones and large zoom**: illustration, status and tip fit without horizontal scrolling at 320 px width and 200 % zoom.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The app MUST show the wake-up screen in place of the current spinner whenever it is waiting for the initial "is this person signed in?" answer.
- **FR-002**: If the answer arrives within 1 second, the wake-up content (illustration, stages, tips) MUST NOT appear; before that point the screen stays calm and nearly empty. Once the content has appeared, it MUST stay visible for at least half a second before moving on.
- **FR-003**: The wake-up screen MUST state in plain, friendly words that the person's home is waking up and that it usually takes under a minute.
- **FR-004**: The status message MUST advance through a fixed sequence of at least three stages based on elapsed time, the last of which holds until the answer arrives. It MUST NOT show a percentage or a progress bar that pretends to measure real progress.
- **FR-005**: The screen MUST show a rotating set of at least 8 short tips about using Hogar, each visible for at least 6 seconds, without repeating within one wait. Tips MUST be accurate for features that exist today.
- **FR-006**: The screen MUST include an on-brand animated illustration; with reduced motion requested, it MUST be still and tip changes MUST NOT animate.
- **FR-007**: While waiting, failed or timed-out attempts caused by the server still starting MUST be retried automatically. Only a definitive "not signed in" answer from a running server may send the person to the login page.
- **FR-008**: After 90 seconds without an answer, the screen MUST switch to a "taking longer than usual" state with a "Try again" action that restarts the wait.
- **FR-009**: When the device reports being offline, the screen MUST say so instead of the waking message and MUST continue automatically once the connection returns.
- **FR-010**: When the answer arrives, the person MUST land where they would have landed without the wait: their requested page (including query and fragment) if signed in, the login page if not.
- **FR-011**: The screen MUST be accessible: the status lives in a polite live region announced at start, at each stage change and when switching to the retry or offline states; rotating tips MUST NOT be announced; "Try again" MUST be reachable and usable by keyboard with visible focus.
- **FR-012**: All copy MUST go through i18n in `en` and `es` with the same keys, following the joyful, approachable tone of `docs/design.md`; the plan MUST list every new key in both locales.
- **FR-013**: The screen MUST work in light and dark themes with AA contrast, use only semantic tokens, and fit narrow phones (320 px) and 200 % zoom without horizontal scrolling.
- **FR-014**: Loading states inside the app after the initial answer (lists, forms, dialogs) are out of scope and MUST remain unchanged.

### Key Entities

- **Wake-up stage**: one step of the status sequence; has its message and the elapsed time at which it begins. The last stage holds until the answer arrives.
- **Tip**: a short, friendly sentence about using Hogar, shown in a fixed order during a wait.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In automated tests that simulate a server waking for up to 90 seconds, including failed first attempts, 100 % of signed-in members land on their requested page and 0 % are sent to the login page.
- **SC-002**: When the server answers within 1 second, the wake-up content never becomes visible (verified by an automated test).
- **SC-003**: Shown the screen for 3 seconds, 5 out of 5 people asked can say what is happening and roughly how long it will take.
- **SC-004**: A 60-second wait shows at least 8 different tips and no repeats.
- **SC-005**: Zero automated accessibility violations on the wake-up, retry and offline states in both themes, and no continuous animation when reduced motion is on.
- **SC-006**: Every new string exists in `en` and `es`, and the locale parity check passes.

## Assumptions

- **Entertainment means an illustration, status stages and tips, not a mini-game.** A playable game would add scope against Principle I (small and polished) and edge toward gamification, which the constitution keeps out of scope.
- **Timings**: 1 second before content appears, 6 seconds per tip and a 90-second limit are reasonable defaults for a 30–50-second cold start; the plan may fine-tune them within the spirit of each requirement.
- **Only the initial check needs this.** That check always runs first, so by the time the person reaches the login page or any other screen, the server is already awake; sign-in and in-app requests are not covered.
- **No server changes are needed for the screen itself.** Keeping the server permanently awake (for example with a scheduled ping) is a separate, complementary decision and is not part of this feature.
- **The current "Loading your home…" copy is replaced** by the new wake-up copy; no visitor data is collected or stored by this screen.
- **The illustration** is drawn for Hogar in the brand palette and follows the existing logo's style; no third-party animation assets are licensed.
