// Persistent (cross-reload) caching for @depmap/api.
//
// ⚠️  This is a PROTOTYPE-ONLY feature. ⚠️
//
// The normal @depmap/api cache (see createJsonClient.ts) lives only in memory,
// so it clears itself every time the page reloads and never needs eviction.
// This module lets you opt a *subset* of calls into a longer-lived cache:
// when enabled, anything routed through the `cached(...)` decorator stores its
// GET/POST response in IndexedDB and reuses it across reloads, with a TTL for
// staleness. Calls that do NOT go through `cached(...)` are unaffected and stay
// uncached, exactly as before.
//
// `enablePersistentApiCache()` is a single global switch (call it once, e.g. at
// the top level of a module that runs during app startup). It does not force
// caching onto anything — it only changes what `cached(...)` does, swapping its
// in-memory store for the persistent one. It still prints a loud banner,
// because a developer elsewhere wrapping a call in `cached(...)` and expecting
// per-session memory caching would instead get day-old data from disk.
//
// Why IndexedDB and not localStorage? The motivating use case is a page that
// fetches many *large* payloads. localStorage caps out around 5MB per origin
// and is synchronous (it blocks the main thread), so large responses would
// blow the quota almost immediately. IndexedDB holds far more and is async.
// If your payloads are reliably small and you'd rather have fewer moving
// parts, the idbGet/idbSet helpers below are the only thing you'd need to swap.

const CACHE_VERSION = 1;
const DB_NAME = "depmap-api-cache";
const STORE_NAME = "responses";
const DB_VERSION = 1;

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

interface CacheEntry {
  value: unknown;
  timestamp: number;
}

let persistentCacheEnabled = false;
let ttlMs = DEFAULT_TTL_MS;

// Namespacing the stored key with a version lets you invalidate everything at
// once by bumping CACHE_VERSION: old keys simply become unreachable.
const versionedKey = (key: string) => `v${CACHE_VERSION}:${key}`;

// ---------------------------------------------------------------------------
// Minimal promise-based IndexedDB key/value store (no dependencies).
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onupgradeneeded = () => {
        if (!openRequest.result.objectStoreNames.contains(STORE_NAME)) {
          openRequest.result.createObjectStore(STORE_NAME);
        }
      };

      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
  }

  return dbPromise;
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbClear(): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// ---------------------------------------------------------------------------
// Internal surface consumed by createJsonClient.ts
// ---------------------------------------------------------------------------

export function isPersistentApiCacheEnabled(): boolean {
  return persistentCacheEnabled;
}

// Returns { hit: false } on a miss, an expired entry, or any storage error.
// Errors are swallowed (and warned) so a flaky cache never breaks a request.
export async function persistentCacheGet(
  key: string
): Promise<{ hit: boolean; value?: unknown }> {
  try {
    const entry = await idbGet<CacheEntry>(versionedKey(key));

    if (!entry) {
      return { hit: false };
    }

    if (Date.now() - entry.timestamp > ttlMs) {
      // Stale. Treat as a miss; the fresh value overwrites it on the next set.
      return { hit: false };
    }

    return { hit: true, value: entry.value };
  } catch (e) {
    window.console.warn("[persistent-api-cache] read failed:", e);
    return { hit: false };
  }
}

export async function persistentCacheSet(
  key: string,
  value: unknown
): Promise<void> {
  try {
    const entry: CacheEntry = { value, timestamp: Date.now() };
    await idbSet(versionedKey(key), entry);
  } catch (e) {
    window.console.warn("[persistent-api-cache] write failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Public surface for app code
// ---------------------------------------------------------------------------

// Wipe every cached response. Use this if you need a clean slate without
// waiting for the TTL to expire.
export async function clearPersistentApiCache(): Promise<void> {
  try {
    await idbClear();
    window.console.warn("[persistent-api-cache] cleared.");
  } catch (e) {
    window.console.warn("[persistent-api-cache] clear failed:", e);
  }
}

// Make the `cached(...)` decorator use a persistent (cross-reload) store
// instead of its in-memory cache, for the whole app. Intended to be called
// once, at module load. This does NOT enable caching on its own — only calls
// that already go through `cached(...)` are affected. `ttlMs` controls how long
// a stored response is served before it is considered stale (default: 1 day).
export function enablePersistentApiCache(options?: { ttlMs?: number }): void {
  persistentCacheEnabled = true;

  if (options && typeof options.ttlMs === "number") {
    ttlMs = options.ttlMs;
  }

  announce(ttlMs);
}

function announce(activeTtlMs: number): void {
  const hours = activeTtlMs / (60 * 60 * 1000);
  const ttlLabel = Number.isInteger(hours)
    ? `${hours}h`
    : `${hours.toFixed(1)}h`;

  window.console.warn(
    "%c⚠ PERSISTENT API CACHE ENABLED ⚠",
    "font-size:16px;font-weight:bold;color:#fff;background:#c0392b;padding:6px 10px;border-radius:3px;"
  );

  window.console.warn(
    [
      "[persistent-api-cache] Any @depmap/api call routed through cached(...)",
      `now saves its response to IndexedDB ("${DB_NAME}") and reuses it across`,
      `page reloads for up to ${ttlLabel}. Calls NOT wrapped in cached(...) are`,
      "unaffected. If you wrapped a call in cached(...) expecting per-session",
      "memory caching and are seeing stale data, THIS IS WHY.",
      "",
      "To reset: call clearPersistentApiCache(), or delete the",
      `"${DB_NAME}" database under Application > IndexedDB in devtools.`,
      "To disable: remove the enablePersistentApiCache() call and reload.",
    ].join("\n")
  );
}
