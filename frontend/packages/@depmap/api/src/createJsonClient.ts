import qs from "qs";
import { ErrorDetail, ErrorTypeError } from "@depmap/types";

const cache: Record<string, Promise<unknown> | null> = {};
let useCache = false;

export const cacheOn = () => {
  useCache = true;
};

export const cacheOff = () => {
  useCache = false;
};

interface BreadboxCustomException {
  detail: string | ErrorDetail; // also string type for backwards compatibility.
}

function instanceOfBreadboxCustomException(
  object: any
): object is BreadboxCustomException {
  return typeof object === "object" && object !== null && "detail" in object;
}

export function instanceOfErrorDetail(object: any): object is ErrorDetail {
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

  if (!useCache) {
    return getJson();
  }

  const json = JSON.stringify(queryParameters || {});
  const cacheKey = `${url}-${json}`;

  if (!cache[cacheKey]) {
    cache[cacheKey] = getJson().catch((e) => {
      delete cache[cacheKey];
      throw e;
    });
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

  if (!useCache) {
    return postJson();
  }

  const json = JSON.stringify(payload || {});
  const cacheKey = `${url}-${json}`;

  if (!cache[cacheKey]) {
    cache[cacheKey] = postJson().catch((e) => {
      delete cache[cacheKey];
      throw e;
    });
  }

  return cache[cacheKey] as Promise<T>;
};

const makePatchJson = (urlPrefix: string) => async <T>(
  url: string,
  payload: unknown
): Promise<T> => {
  if (useCache) {
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
  if (useCache) {
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
  if (useCache) {
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
  if (useCache) {
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
