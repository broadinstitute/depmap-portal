import { breadboxAPI } from "./breadboxAPI";
import { legacyPortalAPI } from "./legacyPortalAPI";
import { cacheOn, cacheOff } from "./createJsonClient";
import type { PersistOption, RequestCacheContext } from "./persistentApiCache";

type AnyApi = typeof breadboxAPI | typeof legacyPortalAPI;

export interface CachedOptions {
  /**
   * Opt this call into the cross-reload IndexedDB store.
   *
   * `true` asserts the response is immutable at its own address. Breadbox never
   * mutates dataset data in place — a new version is a new row with a new UUID —
   * so a response addressed by dataset is valid forever. The engine verifies the
   * assertion by requiring a dataset address in the cache key; a call that turns
   * out not to have one silently stays in memory.
   *
   * `{ deps: [...] }` is for responses that are immutable only given some other
   * dataset. The deps are folded into the cache key, so when a dep changes the
   * key changes and the old entry is orphaned rather than wrongly served.
   */
  persist?: PersistOption;
}

const wrapApiMethodsWithCache = <T extends AnyApi>(
  api: T,
  options: CachedOptions
): T => {
  const wrapped: Partial<T> = {};

  // Always a real object, never null: in createJsonClient, a null ambient
  // context means "not inside cached() at all" and disables the in-memory
  // cache. Plain cached(api) must map to { persist: undefined } — in-memory
  // caching on, persistence off.
  const context: RequestCacheContext = { persist: options.persist };

  (Object.keys(api) as Array<keyof T>).forEach((name) => {
    if (typeof api[name] === "function") {
      wrapped[name] = ((...args: unknown[]) => {
        // Resolve the target at CALL time, not wrap time. Wrappers are memoized
        // for the life of the module, so capturing the function here would
        // freeze it against whatever was installed when the wrapper was first
        // created. Tests mock by reassigning methods on the module-level API
        // object (see how-to-mock-api-functions.test.tsx), and jest is not
        // configured with `resetModules`, so a mock installed after the first
        // cached() call would otherwise be silently ignored.
        const fn = (api[name] as unknown) as (...a: unknown[]) => unknown;

        cacheOn(context);
        const result = fn(...args);
        cacheOff();

        return result;
      }) as T[typeof name];
    }
  });

  return wrapped as T;
};

// Keyed by API object, then by a canonical serialization of the options. See
// the comment in `cached` for why the inner key is a string and not the object.
const wrappedAPIs = new Map<AnyApi, Map<string, AnyApi>>();

// Use this to cache responses from the API. Example:
// `const datasets = await breadboxAPI.getDatasets();`
// becomes
// `const datasets = await cached(breadboxAPI).getDatasets();`
//
// Pass `{ persist: true }` to additionally store the response in IndexedDB so
// it survives a page reload:
// `cached(breadboxAPI, { persist: true }).getMatrixDatasetData(id, args)`
export const cached = <T extends AnyApi>(
  api: T,
  options?: CachedOptions
): T => {
  // Edge case: if someone calls cached(cached(api)) don't wrap it again.
  for (const [unwrapped, byOptions] of wrappedAPIs.entries()) {
    for (const wrapped of byOptions.values()) {
      if (api === wrapped) {
        const name =
          unwrapped === legacyPortalAPI ? "legacyPortalAPI" : "breadboxAPI";

        window.console.warn(
          `cached() called on an already-cached version of ${name}!`
        );

        return api;
      }
    }
  }

  // We store the wrapped objects in a Map so we don't create new wrappers each
  // time `cached` is called. That way you can use a method as a prop without
  // needing to wrap it with `useCallback`.
  //
  // The inner key is a *canonical string*, not the options object, which is what
  // preserves that guarantee now that options exist: an inline literal written
  // fresh on every render (`cached(api, { persist: true })`) serializes to the
  // same string and so resolves to the same wrapper. Keying on object identity
  // would hand back a new wrapper every render and break every dependency array
  // downstream.
  const optionsKey = JSON.stringify(options ?? {});

  if (!wrappedAPIs.has(api)) {
    wrappedAPIs.set(api, new Map());
  }

  const byOptions = wrappedAPIs.get(api) as Map<string, AnyApi>;

  if (!byOptions.has(optionsKey)) {
    byOptions.set(optionsKey, wrapApiMethodsWithCache(api, options ?? {}));
  }

  return byOptions.get(optionsKey) as T;
};
