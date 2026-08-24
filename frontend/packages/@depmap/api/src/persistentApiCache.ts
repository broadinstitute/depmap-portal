// Persistent (cross-reload) caching for @depmap/api.
//
// CORRECTNESS ARGUMENT — the whole thing, in one paragraph:
//
//   Breadbox never mutates dataset data in place. A new version of a dataset is
//   a new row with a new UUID, and `PATCH /datasets/{id}` changes metadata only,
//   never data, never the UUID. Therefore a response addressed by dataset UUID
//   is immutable, and a cached copy of it is valid forever. There is no
//   staleness to detect, so this module contains no invalidation logic — no
//   version comparison on read, no TTL, no revalidation.
//
// Everything below is a consequence of that sentence:
//
//   - given_ids are mutable pointers to "latest", so they cannot be cached as-is.
//     The resolved UUID is *appended* to the key (never substituted into the
//     request — the given_id is the caller's intent and must go on the wire). A
//     new version resolves differently, so the key changes, so the old entry is
//     orphaned rather than wrongly served. Self-invalidating by construction.
//
//   - Deletion needs no handling. Pickers are populated from a fresh
//     `getDatasets()` every load, so a deleted dataset can't be selected and its
//     entries are unreachable garbage. They go cold, and LRU reclaims them.
//     LRU is the TTL.
//
//   - Only PUBLIC datasets are stored. IndexedDB is origin-global and
//     user-agnostic: a shared lab machine, a logout, or a user switch all expose
//     whatever is on disk. Restricting to public data makes that a non-issue,
//     because the next user was entitled to those bytes anyway. Enforced here in
//     `persistentCacheSet` rather than at call sites, so it cannot be forgotten.
//
// The module FAILS CLOSED. Until `initDatasetRegistry` has been called with the
// current dataset listing, `buildPersistentKey` returns null for everything and
// nothing is read or written. A wiring mistake costs cache hits, never
// correctness and never a privacy leak.

const DB_NAME = "depmap-api-cache";
const DB_VERSION = 2;
const RESPONSES = "responses";
const META = "meta";
const EPOCH_KEY = "epoch";
const BYTES_KEY = "totalBytes";

// The manual reset knob. Bump this when the key scheme changes OR when
// shipping a frontend-side fix for anything that may have written bad entries
// (key construction, deps computation). Bumping moves every key into a fresh
// namespace AND wipes every user's store on their next page load.
//
// The full epoch (see enforceEpoch) is this constant composed with the
// Breadbox app version, so backend changes wipe automatically: any
// feat/fix(breadbox) commit bumps that version via commitizen, and cached
// responses produced by the old server code are cleared on next load. Only
// deploys that ship no Breadbox change leave caches warm.
const CACHE_VERSION = 2;

// Breadbox's well-known public group. See breadbox/crud/access_control.py.
export const PUBLIC_GROUP_ID = "00000000-0000-0000-0000-000000000000";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_SCAN_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const DEFAULT_MAX_BYTES = 250 * 1024 * 1024;
// Evict down to this fraction of budget so we aren't evicting on every write.
const EVICT_WATERMARK = 0.9;
// Never store a single item larger than this fraction of budget, or one huge
// response can cursor away the entire store and still not fit.
const MAX_ITEM_FRACTION = 0.1;
const TOUCH_FLUSH_MS = 15_000;

/**
 * `true` asserts the response is immutable at its own dataset address.
 * `{ deps }` additionally names datasets the response depends on but is not
 * addressed by; they are folded into the key.
 */
export type PersistOption = true | { deps: string[] };

/** Ambient context threaded from the decorator through createJsonClient. */
export type RequestCacheContext = { persist?: PersistOption } | null;

interface CacheEntry {
  key: string;
  value: unknown;
  createdAt: number;
  lastAccessed: number;
  size: number;
}

type Status = "uninitialized" | "ready" | "disabled";

let status: Status = "uninitialized";
let db: IDBDatabase | null = null;
let openPromise: Promise<void> | null = null;
let maxBytes = DEFAULT_MAX_BYTES;

/** given_id -> UUID for every dataset visible this session. */
let versionMap: Map<string, string> | null = null;
/** UUIDs of datasets in the public group. Nothing else may be written. */
let publicUuids: Set<string> | null = null;

const touched = new Set<string>();
let touchTimer: ReturnType<typeof setInterval> | null = null;

export const persistentCacheStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  bytesWritten: 0,
  evictions: 0,
  bytesEvicted: 0,
  refusedNotPublic: 0,
  refusedNoDatasetAddress: 0,
  refusedUnresolvable: 0,
  refusedTooLarge: 0,
  refusedNotReady: 0,
  quotaErrors: 0,
  epochWipes: 0,
  // Which branch of address classification each request took. If
  // `unresolvable` is large you have dead bookmarks; if `unlistedUuid` is
  // large your dataset listing is narrower than what requests can reach.
  addressKinds: {
    givenId: 0,
    listedUuid: 0,
    unlistedUuid: 0,
    unresolvable: 0,
  },
};

// ---------------------------------------------------------------------------
// Registry — the public set and the given_id resolution map
// ---------------------------------------------------------------------------

export interface DatasetRegistryEntry {
  id: string;
  given_id?: string | null;
  group_id?: string | null;
}

/**
 * Seed the module from the current dataset listing, then open the store.
 *
 * Call once per page load with the (promise of the) result of an uncached
 * `getDatasets()`, plus the (promise of the) Breadbox app version from an
 * uncached `getBreadboxVersion()`. Call it SYNCHRONOUSLY at entry-point time,
 * passing the pending promises rather than awaiting them first: `openPromise`
 * must exist before the page's first persisted request, or that request sees
 * an uninitialized engine and refuses — silently costing every cache hit
 * issued during those round trips, on every page load.
 *
 * The epoch is composed internally from `CACHE_VERSION` and `breadboxVersion`;
 * a change to either wipes every user's store on their next load.
 */
export function initDatasetRegistry(options: {
  datasets: DatasetRegistryEntry[] | Promise<DatasetRegistryEntry[]>;
  breadboxVersion: string | Promise<string>;
  maxBytes?: number;
}): Promise<void> {
  if (openPromise) {
    return openPromise;
  }

  maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  openPromise = (async () => {
    try {
      const [datasets, breadboxVersion] = await Promise.all([
        options.datasets,
        options.breadboxVersion,
      ]);

      const nextVersionMap = new Map<string, string>();
      const nextPublicUuids = new Set<string>();

      for (const d of datasets) {
        if (d.given_id) {
          nextVersionMap.set(d.given_id, d.id);
        }
        if (d.group_id === PUBLIC_GROUP_ID) {
          nextPublicUuids.add(d.id);
        }
      }

      // A given_id shaped like a UUID would be classified as a UUID by
      // `classifyAddress` and skip resolution, pinning it to whatever version
      // it first fetched. Cheap to detect, so detect it rather than reason
      // about it.
      for (const givenId of nextVersionMap.keys()) {
        if (UUID_RE.test(givenId)) {
          window.console.warn(
            `[persistent-api-cache] given_id "${givenId}" is UUID-shaped, ` +
              `which defeats version resolution. It will not be persisted.`
          );
          nextVersionMap.delete(givenId);
        }
      }

      versionMap = nextVersionMap;
      publicUuids = nextPublicUuids;

      const idb = await openDb();
      await enforceEpoch(idb, `v${CACHE_VERSION}:bb${breadboxVersion}`);

      // Clamp to what the browser will actually grant. Safari denies writes
      // well under 250MB. Done once, off the hot path.
      if (navigator.storage && navigator.storage.estimate) {
        const { quota } = await navigator.storage.estimate();
        if (quota) {
          maxBytes = Math.min(maxBytes, Math.floor(quota * 0.2));
        }
      }

      db = idb;
      status = "ready";
      startTouchFlushing();
    } catch (e) {
      // Never let cache setup break the page. Degrade to in-memory only.
      window.console.warn("[persistent-api-cache] disabled:", e);
      status = "disabled";
      db = null;
    }
  })();

  return openPromise;
}

export function isPersistentApiCacheEnabled(): boolean {
  return status === "ready";
}

// ---------------------------------------------------------------------------
// Key construction — where all the safety lives
// ---------------------------------------------------------------------------

type Address =
  | { kind: "givenId"; raw: string; uuid: string }
  | { kind: "uuid"; raw: string }
  | { kind: "unresolvable"; raw: string };

/**
 * Classify a dataset address.
 *
 * The map is authoritative and checked FIRST, so a UUID-shaped given_id can
 * never be misread as a UUID. The regex only covers a UUID that is valid on the
 * server but absent from our listing (uploaded in another tab, or filtered out
 * of the listing) — real and cacheable, just unlisted.
 *
 * Misclassification is safe by construction: the classification is an input to
 * key *construction*, not a claim stored in the entry. A wrong classification
 * computes a key that no correctly-classified request would compute, so the
 * result is a miss and a refetch. There is no misclassification that yields a
 * wrong hit.
 */
function classifyAddress(raw: string): Address {
  const resolved = versionMap ? versionMap.get(raw) : undefined;

  if (resolved !== undefined) {
    persistentCacheStats.addressKinds.givenId += 1;
    return { kind: "givenId", raw, uuid: resolved };
  }

  if (publicUuids && publicUuids.has(raw)) {
    persistentCacheStats.addressKinds.listedUuid += 1;
    return { kind: "uuid", raw };
  }

  if (UUID_RE.test(raw)) {
    persistentCacheStats.addressKinds.unlistedUuid += 1;
    return { kind: "uuid", raw };
  }

  // Neither a known given_id nor UUID-shaped: a retired given_id from an old
  // bookmark or a stale context. Breadbox won't resolve it either, so the
  // response will be an error. Nothing worth storing.
  persistentCacheStats.addressKinds.unresolvable += 1;
  return { kind: "unresolvable", raw };
}

/**
 * Every dataset-shaped token in the in-memory cache key. The key is built from
 * the URL and the serialized params/payload, so a dataset address appears in it
 * whenever the request names one — in the path for the matrix/tabular/features/
 * samples endpoints, and in the body for `getDimensionData`.
 */
function extractAddresses(cacheKey: string): string[] {
  const found = new Set<string>();

  for (const m of cacheKey.match(UUID_SCAN_RE) ?? []) {
    found.add(m);
  }

  if (versionMap) {
    for (const givenId of versionMap.keys()) {
      // given_ids reach the key via `uri`, which percent-encodes them.
      if (
        cacheKey.includes(givenId) ||
        cacheKey.includes(encodeURIComponent(givenId))
      ) {
        found.add(givenId);
      }
    }
  }

  return Array.from(found);
}

/**
 * Turn an in-memory cache key into a persistent one, or return null if this
 * request must not touch disk.
 *
 * Returning null is always the safe answer, and this function returns it
 * whenever anything is unclear: registry not seeded, no dataset address in the
 * key, an address we can't resolve, or any dataset involved that isn't public.
 */
export async function buildPersistentKey(
  cacheKey: string,
  persist: PersistOption
): Promise<string | null> {
  if (openPromise) {
    await openPromise;
  }

  if (status !== "ready" || versionMap === null || publicUuids === null) {
    persistentCacheStats.refusedNotReady += 1;
    return null;
  }

  const declaredDeps = persist === true ? [] : persist.deps;
  const addresses = extractAddresses(cacheKey);

  if (addresses.length === 0 && declaredDeps.length === 0) {
    // The call site asserted immutability, but nothing in the request names a
    // dataset, so the assertion can't be checked. Refuse rather than trust it.
    persistentCacheStats.refusedNoDatasetAddress += 1;
    return null;
  }

  const resolvedSuffixes: string[] = [];
  const involvedUuids: string[] = [];

  for (const raw of addresses) {
    const address = classifyAddress(raw);

    if (address.kind === "unresolvable") {
      persistentCacheStats.refusedUnresolvable += 1;
      return null;
    }

    if (address.kind === "givenId") {
      // Append, never substitute. Appending keeps the raw given_id in the key,
      // so given_id-addressed and UUID-addressed requests occupy disjoint key
      // spaces and a "latest" entry can never collide with a version-pinned one.
      resolvedSuffixes.push(`${address.raw}=${address.uuid}`);
      involvedUuids.push(address.uuid);
    } else {
      // Already part of cacheKey; nothing to append.
      involvedUuids.push(address.raw);
    }
  }

  for (const raw of declaredDeps) {
    const address = classifyAddress(raw);

    if (address.kind === "unresolvable") {
      persistentCacheStats.refusedUnresolvable += 1;
      return null;
    }

    // Unlike an extracted address, a declared dep appears nowhere in cacheKey,
    // so it must ALWAYS be folded into the suffix — a UUID dep included. When
    // the dep changes (a metadata dataset re-uploaded under a new UUID), the
    // key changes and the old entry is orphaned rather than wrongly served.
    if (address.kind === "givenId") {
      resolvedSuffixes.push(`${address.raw}=${address.uuid}`);
      involvedUuids.push(address.uuid);
    } else {
      resolvedSuffixes.push(address.raw);
      involvedUuids.push(address.raw);
    }
  }

  // Hard requirement: every dataset contributing to this response must be
  // public. Checked here, once, for both addresses and declared deps.
  for (const uuid of involvedUuids) {
    if (!publicUuids.has(uuid)) {
      persistentCacheStats.refusedNotPublic += 1;
      return null;
    }
  }

  resolvedSuffixes.sort();
  const suffix = resolvedSuffixes.length
    ? `|@${resolvedSuffixes.join(",")}`
    : "";

  return `v${CACHE_VERSION}:${cacheKey}${suffix}`;
}

// ---------------------------------------------------------------------------
// IndexedDB plumbing
// ---------------------------------------------------------------------------

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    /* eslint-disable no-param-reassign */
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    /* eslint-enable no-param-reassign */
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const idb = req.result;

      // Destructive upgrade. Everything in v1 was <=24h-TTL prototype data
      // written under the old key scheme; none of it is worth migrating.
      if (idb.objectStoreNames.contains(RESPONSES)) {
        idb.deleteObjectStore(RESPONSES);
      }
      if (idb.objectStoreNames.contains(META)) {
        idb.deleteObjectStore(META);
      }

      const store = idb.createObjectStore(RESPONSES, { keyPath: "key" });
      store.createIndex("lastAccessed", "lastAccessed", { unique: false });
      idb.createObjectStore(META, { keyPath: "key" });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

async function readMetaNumber(
  store: IDBObjectStore,
  key: string
): Promise<number> {
  const rec = await promisify(
    store.get(key) as IDBRequest<{ key: string; value: number } | undefined>
  );
  return rec ? rec.value : 0;
}

/**
 * The kill switch. A persistent cache is the first thing in the stack where
 * "just reload" doesn't clear a bad state, so it needs explicit wipe paths:
 * ship a `CACHE_VERSION` bump (frontend-side fixes) or any Breadbox release
 * (the app version is part of the epoch), and every store clears on next load.
 */
async function enforceEpoch(idb: IDBDatabase, epoch: string): Promise<void> {
  const tx = idb.transaction([RESPONSES, META], "readwrite");
  const meta = tx.objectStore(META);
  const rec = await promisify(
    meta.get(EPOCH_KEY) as IDBRequest<
      { key: string; value: string } | undefined
    >
  );

  if (!rec || rec.value !== epoch) {
    tx.objectStore(RESPONSES).clear();
    meta.put({ key: EPOCH_KEY, value: epoch });
    meta.put({ key: BYTES_KEY, value: 0 });
    if (rec) {
      persistentCacheStats.epochWipes += 1;
    }
  }

  await txDone(tx);
}

// ---------------------------------------------------------------------------
// Read / write, consumed by createJsonClient.ts
// ---------------------------------------------------------------------------

export async function persistentCacheGet(
  key: string
): Promise<{ hit: boolean; value?: unknown }> {
  if (status !== "ready" || !db) {
    return { hit: false };
  }

  try {
    const tx = db.transaction(RESPONSES, "readonly");
    const entry = await promisify(
      tx.objectStore(RESPONSES).get(key) as IDBRequest<CacheEntry | undefined>
    );

    if (!entry) {
      persistentCacheStats.misses += 1;
      return { hit: false };
    }

    // No TTL check and no validation. If it's here, it's valid — the key
    // already encodes everything the response depends on.
    persistentCacheStats.hits += 1;
    touched.add(key);
    return { hit: true, value: entry.value };
  } catch (e) {
    window.console.warn("[persistent-api-cache] read failed:", e);
    persistentCacheStats.misses += 1;
    return { hit: false };
  }
}

export async function persistentCacheSet(
  key: string,
  value: unknown,
  // Accepted for symmetry with the read path and so future policies have a
  // hook; eligibility was already decided in buildPersistentKey.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _persist: PersistOption
): Promise<void> {
  if (status !== "ready" || !db) {
    return;
  }

  // A cheap byte proxy. `JSON.stringify().length` counts UTF-16 code units of
  // JSON text while IndexedDB stores a structured clone, so this over-estimates
  // numeric payloads — conservative in the right direction for a budget.
  let size: number;
  try {
    size = JSON.stringify(value).length;
  } catch {
    return;
  }

  if (size > maxBytes * MAX_ITEM_FRACTION) {
    persistentCacheStats.refusedTooLarge += 1;
    return;
  }

  try {
    await writeEntry(key, value, size);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Our accounting and the browser's can disagree. Make room, retry once.
      persistentCacheStats.quotaErrors += 1;
      try {
        await evictTo(maxBytes * 0.5);
        await writeEntry(key, value, size);
      } catch {
        status = "disabled";
        return;
      }
    } else {
      window.console.warn("[persistent-api-cache] write failed:", e);
      return;
    }
  }

  await maybeEvict();
}

async function writeEntry(
  key: string,
  value: unknown,
  size: number
): Promise<void> {
  if (!db) return;

  const tx = db.transaction([RESPONSES, META], "readwrite");
  const store = tx.objectStore(RESPONSES);
  const meta = tx.objectStore(META);

  const now = Date.now();
  const prior = await promisify(
    store.get(key) as IDBRequest<CacheEntry | undefined>
  );

  store.put({ key, value, createdAt: now, lastAccessed: now, size });

  // Read-modify-write of the byte total happens inside this same transaction.
  // IndexedDB serializes readwrite transactions, so the total stays correct
  // across tabs and needs no periodic recompute sweep.
  const total = await readMetaNumber(meta, BYTES_KEY);
  meta.put({ key: BYTES_KEY, value: total + size - (prior ? prior.size : 0) });

  await txDone(tx);

  persistentCacheStats.writes += 1;
  persistentCacheStats.bytesWritten += size;
}

async function maybeEvict(): Promise<void> {
  if (!db) return;

  const tx = db.transaction(META, "readonly");
  const total = await readMetaNumber(tx.objectStore(META), BYTES_KEY);

  if (total > maxBytes) {
    await evictTo(maxBytes * EVICT_WATERMARK);
  }
}

/** Walk the lastAccessed index coldest-first, deleting until under `target`. */
async function evictTo(target: number): Promise<void> {
  if (!db) return;

  // Flush pending touches first, or we evict on timestamps up to
  // TOUCH_FLUSH_MS stale and drop something that was read seconds ago.
  await flushTouches();
  if (!db) return;

  const tx = db.transaction([RESPONSES, META], "readwrite");
  const store = tx.objectStore(RESPONSES);
  const meta = tx.objectStore(META);

  let total = await readMetaNumber(meta, BYTES_KEY);
  if (total <= target) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const cursorReq = store.index("lastAccessed").openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || total <= target) {
        resolve();
        return;
      }

      const entry = cursor.value as CacheEntry;
      cursor.delete();
      total -= entry.size;
      persistentCacheStats.evictions += 1;
      persistentCacheStats.bytesEvicted += entry.size;
      cursor.continue();
    };

    cursorReq.onerror = () => reject(cursorReq.error);
  });

  meta.put({ key: BYTES_KEY, value: Math.max(0, total) });
  await txDone(tx);
}

// ---------------------------------------------------------------------------
// lastAccessed batching
// ---------------------------------------------------------------------------

/**
 * Reads accumulate keys in memory; one readwrite transaction flushes them
 * periodically. A lost flush costs eviction precision and nothing else.
 */
async function flushTouches(): Promise<void> {
  if (!db || touched.size === 0) {
    return;
  }

  const keys = Array.from(touched);
  touched.clear();

  try {
    const tx = db.transaction(RESPONSES, "readwrite");
    const store = tx.objectStore(RESPONSES);
    const now = Date.now();

    await Promise.all(
      keys.map(async (key) => {
        const entry = await promisify(
          store.get(key) as IDBRequest<CacheEntry | undefined>
        );
        if (entry) {
          entry.lastAccessed = now;
          store.put(entry);
        }
      })
    );

    await txDone(tx);
  } catch {
    // Eviction precision only; nothing to recover.
  }
}

function startTouchFlushing(): void {
  if (touchTimer !== null) {
    return;
  }

  // flushTouches never rejects (it swallows errors internally), so these
  // fire-and-forget calls are safe.
  touchTimer = setInterval(() => {
    flushTouches();
  }, TOUCH_FLUSH_MS);

  window.addEventListener("pagehide", () => {
    flushTouches();
  });
}

// ---------------------------------------------------------------------------
// Test support
// ---------------------------------------------------------------------------

/**
 * Return the module to its pristine (uninitialized, fail-closed) state.
 *
 * FOR TESTS ONLY. This module holds state for the life of the module (`status`,
 * `db`, `versionMap`, `publicUuids`, ...), jest is not configured with
 * `resetModules`, and module registries are shared across tests in a file — so
 * without an explicit reset, the first test to call `initDatasetRegistry`
 * leaks a "ready" engine into every later test in the file. Call this in
 * `beforeEach`/`afterEach`. It does not touch IndexedDB contents; pair it with
 * a fresh `fake-indexeddb` per test for full isolation.
 */
export function __resetForTests(): void {
  if (touchTimer !== null) {
    clearInterval(touchTimer);
    touchTimer = null;
  }
  if (db) {
    db.close();
  }

  status = "uninitialized";
  db = null;
  openPromise = null;
  maxBytes = DEFAULT_MAX_BYTES;
  versionMap = null;
  publicUuids = null;
  touched.clear();

  persistentCacheStats.hits = 0;
  persistentCacheStats.misses = 0;
  persistentCacheStats.writes = 0;
  persistentCacheStats.bytesWritten = 0;
  persistentCacheStats.evictions = 0;
  persistentCacheStats.bytesEvicted = 0;
  persistentCacheStats.refusedNotPublic = 0;
  persistentCacheStats.refusedNoDatasetAddress = 0;
  persistentCacheStats.refusedUnresolvable = 0;
  persistentCacheStats.refusedTooLarge = 0;
  persistentCacheStats.refusedNotReady = 0;
  persistentCacheStats.quotaErrors = 0;
  persistentCacheStats.epochWipes = 0;
  persistentCacheStats.addressKinds.givenId = 0;
  persistentCacheStats.addressKinds.listedUuid = 0;
  persistentCacheStats.addressKinds.unlistedUuid = 0;
  persistentCacheStats.addressKinds.unresolvable = 0;
}

// ---------------------------------------------------------------------------
// Public surface for app code
// ---------------------------------------------------------------------------

/** Wipe every cached response without waiting for an epoch change. */
export async function clearPersistentApiCache(): Promise<void> {
  if (openPromise) {
    await openPromise;
  }

  if (!db) return;

  try {
    const tx = db.transaction([RESPONSES, META], "readwrite");
    tx.objectStore(RESPONSES).clear();
    tx.objectStore(META).put({ key: BYTES_KEY, value: 0 });
    touched.clear();
    await txDone(tx);
    window.console.warn("[persistent-api-cache] cleared.");
  } catch (e) {
    window.console.warn("[persistent-api-cache] clear failed:", e);
  }
}

/**
 * Counters for tuning. You cannot pick `maxBytes` or judge whether this feature
 * earns its complexity without hit rate, eviction rate, and refusal rate.
 */
export async function getPersistentApiCacheInfo(): Promise<{
  status: Status;
  maxBytes: number;
  totalBytes: number;
  publicDatasets: number;
  stats: typeof persistentCacheStats;
}> {
  if (openPromise) {
    await openPromise;
  }

  let totalBytes = 0;
  if (db) {
    const tx = db.transaction(META, "readonly");
    totalBytes = await readMetaNumber(tx.objectStore(META), BYTES_KEY);
  }

  return {
    status,
    maxBytes,
    totalBytes,
    publicDatasets: publicUuids ? publicUuids.size : 0,
    stats: { ...persistentCacheStats },
  };
}
