import qs from "qs";
import { ErrorDetail, ErrorTypeError } from "@depmap/types";
import {
  persistentCacheGet,
  persistentCacheSet,
  buildPersistentKey,
} from "./persistentApiCache";
import type { RequestCacheContext } from "./persistentApiCache";

const cache: Record<string, Promise<unknown> | null> = {};

// Ambient request context, set by the `cached(...)` decorator immediately before
// it invokes an API method and cleared immediately after. `null` means "not
// inside cached(...)"; a non-null value means the in-memory cache is on, and its
// `persist` field says whether the response may also go to IndexedDB.
//
// This is dynamic scoping, and it only works because every layer between
// cacheOn() and the getJson/postJson call below is synchronous up to the point
// the request is issued. The API methods are `async`, but an async function body
// runs synchronously until its first `await`, and none of them awaits anything
// before delegating here. Read `cacheContext` into a local at the top of each
// maker function; do not read it after an await.
let cacheContext: RequestCacheContext = null;

export const cacheOn = (
  context: RequestCacheContext = { persist: undefined }
) => {
  cacheContext = context;
};

export const cacheOff = () => {
  cacheContext = null;
};

interface BreadboxCustomException {
  detail: string | ErrorDetail; // also string type for backwards compatibility.
}

function instanceOfBreadboxCustomException(
  object: any
): object is BreadboxCustomException {
  return typeof object === "object" && object !== null && "detail" in object;
}

function instanceOfErrorDetail(object: any): object is ErrorDetail {
  return (
    typeof object === "object" &&
    object !== null &&
    "error_type" in object &&
    "message" in object
  );
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  let response: Response;

  const headers = new Headers(options.headers || {});

  // Only add Accept if not a multipart/form-data request
  if (!(options.body instanceof FormData) && !headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  try {
    response = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });
  } catch (err) {
    window.console.error("Network or fetch error:", err);
    throw new Error("Network request failed");
  }

  // Handle 404 and other non-JSON responses gracefully
  if (!response.ok) {
    // Check if response is JSON before trying to parse
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const json = await response.json();
      if (instanceOfBreadboxCustomException(json)) {
        throw new ErrorTypeError(
          instanceOfErrorDetail(json.detail)
            ? {
                errorType: json.detail.error_type,
                message: json.detail.message,
              }
            : {
                errorType: "UNSPECIFIED_LEGACY_ERROR",
                message: json.detail,
              }
        );
      } else {
        const message =
          typeof json === "object" && json !== null
            ? JSON.stringify(json)
            : `Request failed with status ${response.status}`;
        throw new Error(message);
      }
    } else if (response.status === 404) {
      throw new Error(`Endpoint not found: ${url}`);
    } else {
      // Non-JSON error response (like HTML 404 page)
      throw new Error(`Request failed with status ${response.status}`);
    }
  }

  // Only try to parse JSON for successful responses
  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    window.console.error("Failed to parse JSON response:", err);
    throw new Error("Failed to parse JSON response");
  }

  return json as T;
}

// Reached only from inside a `cached(...)` call. When that call opted into
// persistence, this layers a cross-reload IndexedDB store underneath the
// in-memory promise cache: check the store first, and on a miss run the request
// and write the result back. Otherwise it's a passthrough and `cached(...)`
// behaves exactly as before (in-memory only).
//
// `context` is passed in rather than read from the module global, because by the
// time this runs the decorator has already called cacheOff().
async function resolveWithPersistence<T>(
  cacheKey: string,
  context: RequestCacheContext,
  producer: () => Promise<T>
): Promise<T> {
  if (context === null || context.persist === undefined) {
    return producer();
  }

  // The persistent key can differ from the in-memory one: for a given_id-
  // addressed request it carries the resolved dataset UUID, and for a request
  // with declared deps it carries those too. Returns null when the request
  // isn't eligible for disk at all, in which case this degrades to in-memory.
  const persistentKey = await buildPersistentKey(cacheKey, context.persist);

  if (persistentKey === null) {
    return producer();
  }

  const { hit, value } = await persistentCacheGet(persistentKey);
  if (hit) {
    return value as T;
  }

  const fresh = await producer();
  await persistentCacheSet(persistentKey, fresh, context.persist);
  return fresh;
}

const makeGetJson = (urlPrefix: string) => <T>(
  url: string,
  queryParameters?: Record<string, unknown>,
  options?: RequestInit
): Promise<T> => {
  const getJson = () => {
    let fullUrl = `${urlPrefix}${url}`;

    if (
      queryParameters &&
      Object.values(queryParameters).some((val) => val !== undefined)
    ) {
      fullUrl += "?" + qs.stringify(queryParameters, { arrayFormat: "repeat" });
    }

    return request<T>(fullUrl, { method: "GET", ...options });
  };

  // Captured synchronously: the decorator clears it as soon as this returns.
  const context = cacheContext;

  if (context === null) {
    return getJson();
  }

  const json = JSON.stringify(queryParameters || {});
  // Include the urlPrefix so the persistent store can't collide entries
  // between the breadbox and legacy-portal backends (they can share a path).
  const cacheKey = `${urlPrefix}${url}-${json}`;

  if (!cache[cacheKey]) {
    cache[cacheKey] = resolveWithPersistence(cacheKey, context, getJson).catch(
      (e) => {
        delete cache[cacheKey];
        throw e;
      }
    );
  }

  return cache[cacheKey] as Promise<T>;
};

const makePostJson = (urlPrefix: string) => async <T>(
  url: string,
  payload: unknown
): Promise<T> => {
  const postJson = () => {
    return request<T>(`${urlPrefix}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  // Captured synchronously: the decorator clears it as soon as this returns.
  const context = cacheContext;

  if (context === null) {
    return postJson();
  }

  const json = JSON.stringify(payload || {});
  const cacheKey = `${urlPrefix}${url}-${json}`;

  if (!cache[cacheKey]) {
    cache[cacheKey] = resolveWithPersistence(cacheKey, context, postJson).catch(
      (e) => {
        delete cache[cacheKey];
        throw e;
      }
    );
  }

  return cache[cacheKey] as Promise<T>;
};

const makePatchJson = (urlPrefix: string) => async <T>(
  url: string,
  payload: unknown
): Promise<T> => {
  if (cacheContext !== null) {
    window.console.warn("PATCH requests cannot be cached");
  }

  return request<T>(`${urlPrefix}${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

const makeDeleteJson = (urlPrefix: string) => async <T>(
  url: string,
  payload?: unknown
): Promise<T> => {
  if (cacheContext !== null) {
    window.console.warn("DELETE requests cannot be cached");
  }

  const options: RequestInit = {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  };

  if (payload !== undefined) {
    options.body = JSON.stringify(payload);
  }

  return request<T>(`${urlPrefix}${url}`, options);
};

const makePostMultipart = (urlPrefix: string) => async <T>(
  url: string,
  args: Record<
    string,
    Blob | string | File | number | boolean | null | undefined
  >
): Promise<T> => {
  if (cacheContext !== null) {
    window.console.warn("Multipart POST requests cannot be cached");
  }

  const formData = new FormData();

  Object.entries(args).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value as Blob | string);
    }
  });

  return request<T>(`${urlPrefix}${url}`, {
    method: "POST",
    body: formData,
  });
};

const makePatchMultipart = (urlPrefix: string) => async <T>(
  url: string,
  args: Record<
    string,
    Blob | string | File | number | boolean | null | undefined
  >
): Promise<T> => {
  if (cacheContext !== null) {
    window.console.warn("Multipart PATCH requests cannot be cached");
  }

  const formData = new FormData();

  Object.entries(args).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value as Blob | string);
    }
  });

  return request<T>(`${urlPrefix}${url}`, {
    method: "PATCH",
    body: formData,
  });
};

const createJsonClient = (urlPrefix: string) => ({
  getJson: makeGetJson(urlPrefix),
  postJson: makePostJson(urlPrefix),
  patchJson: makePatchJson(urlPrefix),
  deleteJson: makeDeleteJson(urlPrefix),
  postMultipart: makePostMultipart(urlPrefix),
  patchMultipart: makePatchMultipart(urlPrefix),
});

export default createJsonClient;
