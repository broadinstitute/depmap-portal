import { getUrlPrefix, isElara } from "@depmap/globals";
import createJsonClient from "../createJsonClient";

const {
  getJson,
  postJson,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
} = createJsonClient(`${getUrlPrefix()}${isElara ? "" : "/breadbox"}`);

const cache: Record<string, Promise<unknown> | null> = {};

// TODO: Deprecate this method and provide caching through
// @tanstack/react-query
const getJsonCached = <T>(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryParameters?: Record<string, any>
): Promise<T> => {
  const json = JSON.stringify(queryParameters || {});
  const cacheKey = `${url}-${json}`;

  if (!cache[cacheKey]) {
    cache[cacheKey] = getJson<T>(url, queryParameters).catch((e) => {
      delete cache[cacheKey];
      throw e;
    });
  }

  return cache[cacheKey] as Promise<T>;
};

const postCache: Record<string, Promise<unknown> | null> = {};

const postJsonCached = <T>(
  url: string,
  body?: Record<string, any>
): Promise<T> => {
  const json = JSON.stringify(body || {});
  const cacheKey = `${url}-${json}`;

  if (!postCache[cacheKey]) {
    postCache[cacheKey] = postJson<T>(url, body).catch((e) => {
      delete postCache[cacheKey];
      throw e;
    });
  }

  return postCache[cacheKey] as Promise<T>;
};

export {
  getJson,
  getJsonCached,
  postJson,
  postJsonCached,
  patchJson,
  deleteJson,
  postMultipart,
  patchMultipart,
};
