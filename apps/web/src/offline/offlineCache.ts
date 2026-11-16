import { API_VERSION, authUserSchema, type AuthUser, type CurrentHousehold } from "@hogar/shared";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { z } from "zod";
import { householdKeys } from "../household/useHousehold";

/** Kept data older than this is discarded (ADR 0015). */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DATA_KEY = "hogar-offline-data";
const PERSON_KEY = "hogar-offline-person";

/** Who the kept data belongs to: name, language and avatar, never the email, a token or the session. */
const savedPersonSchema = authUserSchema.pick({ id: true, name: true, locale: true, avatarUrl: true });
export type SavedPerson = z.infer<typeof savedPersonSchema>;
const personRecordSchema = z.object({ person: savedPersonSchema, savedAt: z.number() });

export interface OfflineCacheOptions {
  /** Where data is kept; `localStorage` in the app. Reading it may throw where the browser blocks it. */
  storage: () => Storage;
  /** Whether Hogar runs as the installed app, the only place data is ever kept. */
  isInstalled: () => boolean;
}

export interface OfflineCache {
  /** Options for `PersistQueryClientProvider`, or `null` in a browser tab, where nothing is kept. */
  readonly persistOptions: PersistQueryClientProviderProps["persistOptions"] | null;
  /** The person the kept data belongs to, while it is fresh enough to show. */
  savedPerson(): SavedPerson | null;
  /**
   * Called once the session says who is signed in. Kept data that isn't provably theirs (someone
   * else's, or with no owner) is erased, from memory too, before anything shows it; then this
   * person is remembered as its owner.
   */
  confirmPerson(user: AuthUser): void;
  /** Erases everything kept, owner included: the session is over on this device. */
  erase(): void;
}

/** True in the app opened from the home screen or desktop, in its own window. */
export function runsInstalled(): boolean {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return standalone || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Decides what the installed app keeps on the device and when it is erased (ADR 0015). It extends
 * TanStack Query's own cache with its official persister, so kept data is exactly what the screens
 * last loaded. Only household data loaded in the last seven days is kept, never the session, and
 * only while the person is in a household: when the server says they aren't (they left, or were
 * removed and see the removal notice), the data goes.
 */
export function createOfflineCache(options: OfflineCacheOptions, queryClient: QueryClient): OfflineCache {
  const storage = deviceStorage(options);
  // Where the browser blocks storage, the installed app keeps nothing, like a browser tab.
  const installed = storage !== null && options.isInstalled();

  const remove = (key: string) => {
    try {
      storage?.removeItem(key);
    } catch {
      // Blocked storage held nothing to erase.
    }
  };

  const readPerson = () => {
    try {
      const parsed = personRecordSchema.safeParse(JSON.parse(storage?.getItem(PERSON_KEY) ?? "null"));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  /** The household's data goes, in memory too, so the next save can't bring it back. */
  const eraseData = () => {
    queryClient.removeQueries({ predicate: (query) => isHouseholdData(query) && !isCurrentHousehold(query) });
    remove(DATA_KEY);
  };

  const erase = () => {
    eraseData();
    remove(PERSON_KEY);
  };

  if (installed) {
    // Kept data must outlive its screens in memory too, or it would be dropped before being kept.
    const defaults = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, gcTime: OFFLINE_MAX_AGE_MS } });

    queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || !isCurrentHousehold(event.query)) return;
      const data = event.query.state.data as CurrentHousehold | undefined;
      if (data?.household === null) eraseData();
    });
  }

  const inHousehold = () => queryClient.getQueryData<CurrentHousehold>(householdKeys.current)?.household != null;
  // The persister stamps every save with the time of saving, so the age of the data itself is
  // checked here: data that hasn't been reloaded for seven days is never saved again.
  const isFresh = (query: Query) => Date.now() - query.state.dataUpdatedAt <= OFFLINE_MAX_AGE_MS;

  return {
    persistOptions:
      installed && storage
        ? {
            persister: createSyncStoragePersister({ storage, key: DATA_KEY }),
            maxAge: OFFLINE_MAX_AGE_MS,
            // Data shaped for an older API is dropped along with it.
            buster: String(API_VERSION),
            dehydrateOptions: {
              shouldDehydrateQuery: (query) =>
                query.state.status === "success" && isHouseholdData(query) && isFresh(query) && inHousehold(),
            },
          }
        : null,
    savedPerson() {
      if (!installed) return null;
      const record = readPerson();
      if (record && Date.now() - record.savedAt <= OFFLINE_MAX_AGE_MS) return record.person;
      remove(PERSON_KEY);
      return null;
    },
    confirmPerson(user) {
      if (!installed) return;
      if (readPerson()?.person.id !== user.id) {
        queryClient.clear();
        eraseData();
      }
      const person: SavedPerson = { id: user.id, name: user.name, locale: user.locale, avatarUrl: user.avatarUrl };
      try {
        storage?.setItem(PERSON_KEY, JSON.stringify({ person, savedAt: Date.now() }));
      } catch {
        // Not remembered: the next launch treats the data as ownerless and erases it.
      }
    },
    erase,
  };
}

function deviceStorage({ storage }: OfflineCacheOptions): Storage | null {
  try {
    return storage();
  } catch {
    return null;
  }
}

function isHouseholdData(query: Query): boolean {
  return query.queryKey[0] === householdKeys.current[0];
}

function isCurrentHousehold(query: Query): boolean {
  return query.queryKey.length === householdKeys.current.length && isHouseholdData(query);
}
