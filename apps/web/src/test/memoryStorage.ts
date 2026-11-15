import type { OfflineCacheOptions } from "../offline/offlineCache";

/** An in-memory `Storage`, so tests can launch the app twice on the "same device" and read what it kept. */
export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  clear() {
    this.items.clear();
  }

  /** Everything kept, as one string to search. */
  contents() {
    return [...this.items].map(([key, value]) => `${key}=${value}`).join("\n");
  }
}

/** Hogar in a browser tab, which keeps nothing on the device. */
export function browserTab(): OfflineCacheOptions {
  return { storage: () => new MemoryStorage(), isInstalled: () => false };
}
