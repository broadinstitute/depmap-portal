import { breadboxAPI } from "./breadboxAPI";
import { legacyPortalAPI } from "./legacyPortalAPI";
import { cacheOn, cacheOff } from "./createJsonClient";

type AnyApi = typeof breadboxAPI | typeof legacyPortalAPI;

const wrapApiMethodsWithCache = <T extends AnyApi>(api: T): T => {
  const wrapped: Partial<T> = {};

  (Object.keys(api) as Array<keyof T>).forEach((name) => {
    const originalFn = api[name];

    if (typeof originalFn === "function") {
      wrapped[name] = ((...args: unknown[]) => {
        cacheOn();
        const result = originalFn(...args);
        cacheOff();

        return result;
      }) as T[typeof name];
    }
  });

  return wrapped as T;
};

const wrappedAPIs = new Map<AnyApi, AnyApi>();

// Use this to cache responses from the API. Example:
// `const datasets = await breadboxAPI.getDatasets();`
// becomes
// `const datasets = await cached(breadboxAPI).getDatasets();`
export const cached = <T extends AnyApi>(api: T): T => {
  // We store the wrapped objects in a Map so we don't create new wrappers each
  // time `cached` is called. That way you can use a method as a prop without
  // needing to wrap it with `useCallback`.
  if (!wrappedAPIs.has(api)) {
    wrappedAPIs.set(api, wrapApiMethodsWithCache(api));
  }

  return wrappedAPIs.get(api) as T;
};
