import qs from "qs";

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

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    window.console.error("Failed to parse JSON response:", err);
    throw new Error("Failed to parse JSON response");
  }

  if (response.ok) {
    return json as T;
  }

  const message =
    typeof json === "object" && json !== null
      ? JSON.stringify(json)
      : `Request failed with status ${response.status}`;

  throw new Error(message);
}

const makeGetJson = (urlPrefix: string) => <T>(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryParameters?: Record<string, any>
): Promise<T> => {
  let fullUrl = `${urlPrefix}${url}`;

  if (queryParameters) {
    fullUrl += "?" + qs.stringify(queryParameters);
  }

  return request<T>(fullUrl, { method: "GET" });
};

const makePostJson = (urlPrefix: string) => async <T>(
  url: string,
  payload: unknown
): Promise<T> => {
  return request<T>(`${urlPrefix}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

const makePatchJson = (urlPrefix: string) => async <T>(
  url: string,
  payload: unknown
): Promise<T> => {
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
