import { IDBFactory } from "fake-indexeddb";
import {
  __resetForTests,
  buildPersistentKey,
  getPersistentApiCacheInfo,
  initDatasetRegistry,
  isPersistentApiCacheEnabled,
  persistentCacheGet,
  persistentCacheSet,
  persistentCacheStats,
  PUBLIC_GROUP_ID,
} from "../persistentApiCache";

const PRIVATE_GROUP_ID = "99999999-9999-9999-9999-999999999999";

const PUBLIC_UUID = "aaaaaaaa-0000-0000-0000-000000000001";
const PRIVATE_UUID = "bbbbbbbb-0000-0000-0000-000000000002";
const PUBLIC_DEP_UUID_1 = "cccccccc-0000-0000-0000-000000000003";
const PUBLIC_DEP_UUID_2 = "dddddddd-0000-0000-0000-000000000004";
const RESOLVED_UUID_V1 = "eeeeeeee-0000-0000-0000-000000000005";
const RESOLVED_UUID_V2 = "ffffffff-0000-0000-0000-000000000006";

const defaultDatasets = [
  { id: PUBLIC_UUID, given_id: null, group_id: PUBLIC_GROUP_ID },
  { id: PRIVATE_UUID, given_id: null, group_id: PRIVATE_GROUP_ID },
  { id: PUBLIC_DEP_UUID_1, given_id: null, group_id: PUBLIC_GROUP_ID },
  { id: PUBLIC_DEP_UUID_2, given_id: null, group_id: PUBLIC_GROUP_ID },
  {
    id: RESOLVED_UUID_V1,
    given_id: "some_given_id",
    group_id: PUBLIC_GROUP_ID,
  },
];

async function init(
  options: {
    datasets?: typeof defaultDatasets;
    breadboxVersion?: string;
    maxBytes?: number;
    reuseIndexedDB?: boolean;
  } = {}
) {
  if (!options.reuseIndexedDB) {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  }

  await initDatasetRegistry({
    datasets: options.datasets ?? defaultDatasets,
    breadboxVersion: options.breadboxVersion ?? "0.0.0-test",
    maxBytes: options.maxBytes,
  });
}

afterEach(() => {
  __resetForTests();
  jest.restoreAllMocks();
});

describe("buildPersistentKey", () => {
  it("refuses everything before initDatasetRegistry has run", async () => {
    const key = await buildPersistentKey(`GET /data/${PUBLIC_UUID}`, true);

    expect(key).toBeNull();
    expect(persistentCacheStats.refusedNotReady).toBe(1);
  });

  it("waits for a pending datasets promise instead of refusing", async () => {
    // REGRESSION: the entry points call initDatasetRegistry synchronously with
    // the still-pending getDatasets() promise. Requests issued during that
    // round trip must wait for the registry, not refuse — refusing silently
    // costs every early cache hit on every page load.
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();

    let resolveDatasets!: (d: typeof defaultDatasets) => void;
    const pending = new Promise<typeof defaultDatasets>((resolve) => {
      resolveDatasets = resolve;
    });

    initDatasetRegistry({ datasets: pending, breadboxVersion: "0.0.0-test" });

    const keyPromise = buildPersistentKey(`GET /data/${PUBLIC_UUID}-{}`, true);
    resolveDatasets(defaultDatasets);

    expect(await keyPromise).toContain(PUBLIC_UUID);
    expect(persistentCacheStats.refusedNotReady).toBe(0);
  });

  it("refuses a request that names no dataset", async () => {
    await init();
    const key = await buildPersistentKey("GET /some/other/endpoint-{}", true);

    expect(key).toBeNull();
    expect(persistentCacheStats.refusedNoDatasetAddress).toBe(1);
  });

  it("refuses a request naming a non-public dataset", async () => {
    await init();
    const key = await buildPersistentKey(`GET /data/${PRIVATE_UUID}`, true);

    expect(key).toBeNull();
    expect(persistentCacheStats.refusedNotPublic).toBe(1);
  });

  it("refuses an unresolvable declared dep", async () => {
    await init();
    const key = await buildPersistentKey(`GET /data/${PUBLIC_UUID}`, {
      deps: ["retired_given_id"],
    });

    expect(key).toBeNull();
    expect(persistentCacheStats.refusedUnresolvable).toBe(1);
  });

  it("builds a key for a public UUID-addressed request", async () => {
    await init();
    const cacheKey = `GET /data/${PUBLIC_UUID}-{}`;
    const key = await buildPersistentKey(cacheKey, true);

    expect(key).toContain(cacheKey);
  });

  it("appends the resolved UUID for a given_id-addressed request", async () => {
    await init();
    const cacheKey = "GET /data/some_given_id-{}";
    const key = await buildPersistentKey(cacheKey, true);

    expect(key).toContain(cacheKey);
    expect(key).toContain(`some_given_id=${RESOLVED_UUID_V1}`);
  });

  it("produces a different key when a given_id resolves differently", async () => {
    const cacheKey = "GET /data/some_given_id-{}";

    await init();
    const keyV1 = await buildPersistentKey(cacheKey, true);

    __resetForTests();
    await init({
      datasets: [
        {
          id: RESOLVED_UUID_V2,
          given_id: "some_given_id",
          group_id: PUBLIC_GROUP_ID,
        },
      ],
    });
    const keyV2 = await buildPersistentKey(cacheKey, true);

    expect(keyV1).not.toBeNull();
    expect(keyV2).not.toBeNull();
    expect(keyV1).not.toEqual(keyV2);
  });

  it("warns about and never persists a UUID-shaped given_id", async () => {
    const warn = jest.spyOn(window.console, "warn").mockImplementation();
    const uuidShapedGivenId = "12345678-1234-1234-1234-123456789abc";

    await init({
      datasets: [
        {
          id: PUBLIC_UUID,
          given_id: uuidShapedGivenId,
          group_id: PUBLIC_GROUP_ID,
        },
      ],
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(uuidShapedGivenId)
    );

    // Dropped from the version map, it classifies as an unlisted UUID, which
    // fails the public check — a miss, never a wrong hit.
    const key = await buildPersistentKey(
      `GET /data/${uuidShapedGivenId}`,
      true
    );
    expect(key).toBeNull();
  });

  it("folds declared UUID deps into the key", async () => {
    await init();
    const cacheKey = `GET /data/${PUBLIC_UUID}-{}`;

    const key1 = await buildPersistentKey(cacheKey, {
      deps: [PUBLIC_DEP_UUID_1],
    });
    const key2 = await buildPersistentKey(cacheKey, {
      deps: [PUBLIC_DEP_UUID_2],
    });

    expect(key1).toContain(PUBLIC_DEP_UUID_1);
    expect(key2).toContain(PUBLIC_DEP_UUID_2);
    expect(key1).not.toEqual(key2);
  });
});

describe("persistentCacheGet / persistentCacheSet", () => {
  it("round-trips a value", async () => {
    await init();
    await persistentCacheSet("v2:some-key", { hello: "world" }, true);

    const result = await persistentCacheGet("v2:some-key");

    expect(result.hit).toBe(true);
    expect(result.value).toEqual({ hello: "world" });
    expect(persistentCacheStats.writes).toBe(1);
    expect(persistentCacheStats.hits).toBe(1);
  });

  it("refuses a single item over the per-item budget", async () => {
    await init({ maxBytes: 10_000 });
    await persistentCacheSet("v2:huge", "x".repeat(5_000), true);

    expect(persistentCacheStats.refusedTooLarge).toBe(1);
    expect((await persistentCacheGet("v2:huge")).hit).toBe(false);
  });

  it("evicts coldest-first when over budget", async () => {
    // Deterministic lastAccessed ordering.
    let fakeNow = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => {
      fakeNow += 1_000;
      return fakeNow;
    });

    await init({ maxBytes: 10_000 });

    // ~502 bytes each; 30 writes is ~15KB against a 10KB budget.
    for (let i = 0; i < 30; i++) {
      // eslint-disable-next-line no-await-in-loop
      await persistentCacheSet(`v2:key-${i}`, "x".repeat(500), true);
    }

    expect(persistentCacheStats.evictions).toBeGreaterThan(0);

    const info = await getPersistentApiCacheInfo();
    expect(info.totalBytes).toBeLessThanOrEqual(10_000);

    expect((await persistentCacheGet("v2:key-0")).hit).toBe(false);
    expect((await persistentCacheGet("v2:key-29")).hit).toBe(true);
  });

  it("retries once after QuotaExceededError by making room", async () => {
    await init({ maxBytes: 10_000 });

    // Grab the object store prototype off a second connection to the same
    // fake database so the engine's own `put` can be made to fail.
    const proto = await getResponsesStorePrototype();
    jest.spyOn(proto, "put").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    await persistentCacheSet("v2:quota-key", { ok: true }, true);

    expect(persistentCacheStats.quotaErrors).toBe(1);
    expect((await persistentCacheGet("v2:quota-key")).hit).toBe(true);
    expect(isPersistentApiCacheEnabled()).toBe(true);
  });

  it("survives re-init under the same epoch, wipes when the Breadbox version changes", async () => {
    await init({ breadboxVersion: "4.19.0" });
    await persistentCacheSet("v2:epoch-key", { kept: true }, true);

    // Same CACHE_VERSION + same Breadbox version: entries survive a "reload".
    __resetForTests();
    await init({ breadboxVersion: "4.19.0", reuseIndexedDB: true });
    expect((await persistentCacheGet("v2:epoch-key")).hit).toBe(true);
    expect(persistentCacheStats.epochWipes).toBe(0);

    // A Breadbox release changes the epoch: the whole store is wiped.
    __resetForTests();
    await init({ breadboxVersion: "4.20.0", reuseIndexedDB: true });
    expect((await persistentCacheGet("v2:epoch-key")).hit).toBe(false);
    expect(persistentCacheStats.epochWipes).toBe(1);
  });

  it("disables itself when the quota retry also fails", async () => {
    await init({ maxBytes: 10_000 });

    const proto = await getResponsesStorePrototype();
    jest.spyOn(proto, "put").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    await persistentCacheSet("v2:doomed-key", { ok: true }, true);

    expect(isPersistentApiCacheEnabled()).toBe(false);
  });
});

async function getResponsesStorePrototype() {
  const request = indexedDB.open("depmap-api-cache", 2);

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const tx = db.transaction("responses", "readonly");
  const proto = Object.getPrototypeOf(tx.objectStore("responses"));
  tx.abort();
  db.close();

  return proto;
}
