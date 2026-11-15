# 0015 · Offline is read-only: the last data seen, never offline changes

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Hogar becomes an installable PWA. People will open it from their home screen in places with poor or no signal (a supermarket basement, the metro), and an installed app that shows the browser's offline page feels broken. There are three levels of offline support:

1. **App shell only:** the app opens without network and says it is offline, but shows no data.
2. **Read-only data:** the app also shows the last expenses, balances and lists it saw, marked as possibly out of date.
3. **Full offline:** people create and edit expenses, payments and items without network, and the app syncs them later.

## Decision

- **Level 2.** The installed app opens offline, shows the last data it loaded, says clearly that it is offline and when that data is from, and disables every action that changes something, explaining why.
- **Nothing that changes data is ever queued offline.** Every change still goes straight to the server and only counts once it answers.
- The service worker caches the app's own files and never caches `/api/*`: sessions, cookies and token rotation stay exactly as ADRs 0002 and 0006 describe.
- Being offline is not the same as the server sleeping: with no connection the app shows the offline state instead of the wake-up screen.

## Why not full offline

- **Money must not drift.** An expense saved offline is split with the weights, categories and members the device knew. If someone changed the split, a category or the membership meanwhile, the shares fixed on sync would not be the ones the person saw before saving, which breaks "shares are fixed when saved" and "no cent of drift".
- **Conflicts have no safe automatic answer.** Two people editing or deleting the same expense offline, or a member removed while their offline payment waits, needs merge rules and a conflict screen for each kind of record. Wrong answers here create exactly the money tension the app exists to remove.
- **Permissions are checked when the change happens.** A person demoted to guest or removed from the household while offline would replay changes they are no longer allowed to make; the server would reject them after the person believed they were saved.
- **Sessions don't survive offline.** The access token lives only in memory for 15 minutes, and the refresh token rotates on each use with reuse detection (ADR 0002). Replaying queued requests after a long time offline means refreshing at an uncertain moment, which is the risky path ADR 0006 avoids.
- **Real time assumes one ordered history.** Socket events announce changes as the server accepts them; late offline changes would arrive out of order and with stale names and balances.
- **Cost.** Background sync, a local write queue, conflict resolution and its tests are a project of their own, beyond the MVP's "small, polished and deployed".

## Considered options

- **App shell only:** simplest, but an installed app that shows nothing offline is barely better than the browser page.
- **Full offline with a sync queue:** the best experience on paper, rejected for the reasons above.

## Consequences

- Data is kept on the device **only when Hogar runs installed**: installing is a good sign the device is personal, while a browser tab may be on someone else's computer. In a tab nothing is kept, as before.
- The kept data is erased on sign-out, on the removal notice, when the session is revoked or expires, and when a different person signs in. It never contains tokens or any session data (ADR 0002), and data older than 7 days is discarded.
- Every screen needs an offline state: read-only banner, disabled actions with a reason, and the time of the data shown.
- Full offline stays out of scope; revisiting it needs a new ADR that answers each point above.
