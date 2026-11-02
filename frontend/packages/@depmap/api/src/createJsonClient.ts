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

// Lets a non-browser caller (e.g. the standalone Node bundle) point a client at
// an absolute URL and supply its own auth. When nothing is configured, clients
// behave exactly as they do in the browser: a relative prefix and cookies.
export interface ClientSettings {
  // Replaces the client's entire URL prefix (including any "/breadbox" segment).
  baseUrl?: string;
  // Sent with every request. Per-request headers (Accept, Content-Type) win.
  headers?: Record<string, string>;
  // Replaces the global `fetch`. Useful for signing or otherwise wrapping requests.
  fetch?: typeof fetch;
}

type GetSettings = () => ClientSettings | null;

// Everything `request()` throws is tagged so a caller outside the browser can
// tell "Breadbox didn't give a usable answer" (and with what status) apart from
// a bug elsewhere, without parsing messages. `status` is absent when there was
// no response at all (a network failure).
function markRequestFailure<E extends Error>(error: E, status?: number): E {
  return Object.assign(error, { isRequestFailure: true, status });
}

export function getRequestFailure(error: unknown): { status?: number } | null {
  const tagged = error as {
    isRequestFailure?: boolean;
    status?: number;
  } | null;

  return tagged && tagged.isRequestFailure ? { status: tagged.status } : null;
}

async function request<T>(
  url: string,
  options: RequestInit,
  settings: ClientSettings | null
): Promise<T> {
  let response: Response;

  const headers = new Headers(options.headers || {});

  // Configured headers fill in around the request's own, which take precedence.
  Object.entries(settings?.headers || {}).forEach(([name, value]) => {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  });

  // Only add Accept if not a multipart/form-data request
  if (!(options.body instanceof FormData) && !headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  try {
    const init: RequestInit = {
      // Cookies only make sense for a browser talking to its own origin.
      ...(settings ? {} : { credentials: "include" as const }),
      ...options,
      headers,
    };

    response = settings?.fetch
      ? await settings.fetch(url, init)
      : await fetch(url, init);
  } catch (err) {
    console.error("Network or fetch error:", err);
    throw markRequestFailure(new Error("Network request failed"));
  }

  // Handle 404 and other non-JSON responses gracefully
  if (!response.ok) {
    // Check if response is JSON before trying to parse
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      let json: unknown;

      try {
        json = await response.json();
      } catch (err) {
        console.error("Failed to parse JSON error response:", err);
        throw markRequestFailure(
          new Error(`Request failed with status ${response.status}`),
          response.status
        );
      }

      if (instanceOfBreadboxCustomException(json)) {
        throw markRequestFailure(
          new ErrorTypeError(
            instanceOfErrorDetail(json.detail)
              ? {
                  errorType: json.detail.error_type,
                  message: json.detail.message,
                }
              : {
                  errorType: "UNSPECIFIED_LEGACY_ERROR",
                  message: json.detail,
                }
          ),
          response.status
        );
      } else {
        const message =
          typeof json === "object" && json !== null
            ? JSON.stringify(json)
            : `Request failed with status ${response.status}`;
        throw markRequestFailure(new Error(message), response.status);
      }
    } else if (response.status === 404) {
      throw markRequestFailure(
        new Error(`Endpoint not found: ${url}`),
        response.status
      );
    } else {
      // Non-JSON error response (like HTML 404 page)
      throw markRequestFailure(
        new Error(`Request failed with status ${response.status}`),
        response.status
      );
    }
  }

  // Only try to parse JSON for successful responses
  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    console.error("Failed to parse JSON response:", err);
    throw markRequestFailure(
      new Error("Failed to parse JSON response"),
      response.status
    );
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

const makeGetJson = (getPrefix: () => string, getSettings: GetSettings) => <T>(
  url: string,
  queryParameters?: Record<string, unknown>,
  options?: RequestInit
): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  const getJson = () => {
    let fullUrl = `${urlPrefix}${url}`;

    if (
      queryParameters &&
      Object.values(queryParameters).some((val) => val !== undefined)
    ) {
      fullUrl += "?" + qs.stringify(queryParameters, { arrayFormat: "repeat" });
    }

    return request<T>(fullUrl, { method: "GET", ...options }, settings);
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

const makePostJson = (
  getPrefix: () => string,
  getSettings: GetSettings
) => async <T>(url: string, payload: unknown): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  const postJson = () => {
    return request<T>(
      `${urlPrefix}${url}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      settings
    );
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

const makePatchJson = (
  getPrefix: () => string,
  getSettings: GetSettings
) => async <T>(url: string, payload: unknown): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  if (cacheContext !== null) {
    console.warn("PATCH requests cannot be cached");
  }

  return request<T>(
    `${urlPrefix}${url}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    settings
  );
};

const makeDeleteJson = (
  getPrefix: () => string,
  getSettings: GetSettings
) => async <T>(url: string, payload?: unknown): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  if (cacheContext !== null) {
    console.warn("DELETE requests cannot be cached");
  }

  const options: RequestInit = {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  };

  if (payload !== undefined) {
    options.body = JSON.stringify(payload);
  }

  return request<T>(`${urlPrefix}${url}`, options, settings);
};

const makePostMultipart = (
  getPrefix: () => string,
  getSettings: GetSettings
) => async <T>(
  url: string,
  args: Record<
    string,
    Blob | string | File | number | boolean | null | undefined
  >
): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  if (cacheContext !== null) {
    console.warn("Multipart POST requests cannot be cached");
  }

  const formData = new FormData();

  Object.entries(args).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value as Blob | string);
    }
  });

  return request<T>(
    `${urlPrefix}${url}`,
    {
      method: "POST",
      body: formData,
    },
    settings
  );
};

const makePatchMultipart = (
  getPrefix: () => string,
  getSettings: GetSettings
) => async <T>(
  url: string,
  args: Record<
    string,
    Blob | string | File | number | boolean | null | undefined
  >
): Promise<T> => {
  const urlPrefix = getPrefix();
  const settings = getSettings();

  if (cacheContext !== null) {
    console.warn("Multipart PATCH requests cannot be cached");
  }

  const formData = new FormData();

  Object.entries(args).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value as Blob | string);
    }
  });

  return request<T>(
    `${urlPrefix}${url}`,
    {
      method: "PATCH",
      body: formData,
    },
    settings
  );
};

// `urlPrefix` may be a function so it is resolved per request rather than at
// import time. `getSettings` returns the caller-supplied overrides, if any.
const createJsonClient = (
  urlPrefix: string | (() => string),
  getSettings: GetSettings = () => null
) => {
  // Resolved once, on first use. This used to happen at import time, and the
  // prefix is derived from `window.location`, so it must not drift as the user
  // navigates around a single-page app.
  let defaultPrefix: string | null = null;

  const getPrefix = () => {
    const baseUrl = getSettings()?.baseUrl;

    if (baseUrl !== undefined) {
      return baseUrl.replace(/\/+$/, "");
    }

    if (defaultPrefix === null) {
      defaultPrefix = typeof urlPrefix === "function" ? urlPrefix() : urlPrefix;
    }

    return defaultPrefix;
  };

  return {
    getJson: makeGetJson(getPrefix, getSettings),
    postJson: makePostJson(getPrefix, getSettings),
    patchJson: makePatchJson(getPrefix, getSettings),
    deleteJson: makeDeleteJson(getPrefix, getSettings),
    postMultipart: makePostMultipart(getPrefix, getSettings),
    patchMultipart: makePatchMultipart(getPrefix, getSettings),
  };
};

export default createJsonClient;
