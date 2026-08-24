export { legacyPortalAPI } from "./src/legacyPortalAPI";
export type { LegacyPortalApiResponse } from "./src/legacyPortalAPI";
export { breadboxAPI } from "./src/breadboxAPI";
export type { BreadboxApiResponse } from "./src/breadboxAPI";
export { cached } from "./src/apiCacheDecorator";

export {
  initDatasetRegistry,
  clearPersistentApiCache,
  isPersistentApiCacheEnabled,
  getPersistentApiCacheInfo,
  persistentCacheStats,
  PUBLIC_GROUP_ID,
} from "./src/persistentApiCache";

export type {
  PersistOption,
  DatasetRegistryEntry,
} from "./src/persistentApiCache";

export type { CachedOptions } from "./src/apiCacheDecorator";

export {
  evaluateContextPersisted,
  getDimensionTypeIdentifiersPersisted,
} from "./src/persistedFetches";

// ❌ Don't use! This is only defined to support Elara's TypesPage.tsx
export { deprecatedBreadboxAPI } from "./src/deprecatedBreadboxAPI";
