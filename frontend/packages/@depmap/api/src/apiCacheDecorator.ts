import { breadboxAPI } from "./breadboxAPI";
import { legacyPortalAPI } from "./legacyPortalAPI";
import { cacheOn, cacheOff } from "./createJsonClient";

// Use this to cache responses from the API. Example:
// `const datasets = await breadboxAPI.getDatasets();`
// becomes
// `const datasets = await cached(breadboxAPI).getDatasets();`
export const cached = <T extends typeof breadboxAPI | typeof legacyPortalAPI>(
  api: T
): T => {
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
