import stableStringify from "json-stable-stringify";
import { getUrlPrefix, isElara } from "@depmap/globals";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import { isBreadboxOnlyMode } from "../isBreadboxOnlyMode";
import getContextHash from "./get-context-hash";

// *****************************************************************************
// * Context cache                                                             *
// *****************************************************************************
// `persistContext` and `fetchContext` use the browser's cache (instead of our
// makeshift in-memory cache) so the data is persisted across sessions.
// https://developer.mozilla.org/en-US/docs/Web/API/Cache
//
// The idea behind caching contexts this way is to speed up loading them in
// specific scenarios. Imagine a user selects a large number of points and then
// clicks the "visualize" button to plot them in a new tab. It's awkward to
// pause and wait for the context to be persisted before opening the link. This
// cache allows them to be immediately available while the upload happens in
// the background.
//
// This is possible because the hashing function used by `getContextHash()`
// exactly predicts the hash that will be returned by the /cas/ endpoint.
const CONTEXT_CACHE = "contexts-v1";
const successfullyPersistedContexts = new Set<string>();
// Fall back to using an in-memory cache if the user has caching disabled.
const fallbackInMemoryCache: Record<
  string,
  DataExplorerContext | DataExplorerContextV2
> = {};

// Both the legacy Portal and Breadbox have /cas/ and /cas/{key} endpoints for
// storing and retrieving content. This allows contexts to be sharable. Links
// to Data Explorer plots contain hashes that reference this shared storage.
// https://en.wikipedia.org/wiki/Content-addressable_storage
// In the legacy Portal, these are persisted to an S3 bucket. Breadbox
// implements the same set of endpoints but stores them in its database
// instead.
const getCasUrl = () => {
  if (!isBreadboxOnlyMode) {
    return `${getUrlPrefix()}/cas`;
  }

  return isElara
    ? `${getUrlPrefix()}/temp/cas`
    : `${getUrlPrefix()}/breadbox/temp/cas`;
};

const getContextUrl = (hash: string) => {
  return `${getCasUrl()}/${hash}`;
};

export async function persistContext(
  context: DataExplorerContext | DataExplorerContextV2
): Promise<string> {
  const hash = await getContextHash(context);

  if (successfullyPersistedContexts.has(hash)) {
    return hash;
  }

  const json = stableStringify(context);
  let cacheSuccess = false;

  try {
    // window.caches.open() will throw an error in Firefox when the user is in
    // "private browsing mode."
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1724607
    // https://support.mozilla.org/en-US/kb/private-browsing-use-firefox-without-history
    const cache = await window.caches.open(CONTEXT_CACHE);

    // Make a fake request/response object that simulates fetchContext() below
    // and store it in the cache for instant retrievable.
    const request = new Request(getContextUrl(hash));
    const blobPart = JSON.stringify({ value: json });
    const blob = new Blob([blobPart], { type: "application/json" });
    const init = { status: 200, statusText: "OK" };
    const response = new Response(blob, init);

    await cache.put(request, response);
    cacheSuccess = true;
  } catch (e) {
    window.console.error("Failed to cache context", e);
    fallbackInMemoryCache[hash] = context;
  }

  const url = isBreadboxOnlyMode ? getCasUrl() : `${getCasUrl()}/`;
  const options = {
    method: "POST",
    headers: isBreadboxOnlyMode
      ? {
          Accept: "application/json",
          "Content-Type": "application/json",
        }
      : {
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
    body: isBreadboxOnlyMode
      ? JSON.stringify({ value: json })
      : new URLSearchParams({ value: json }),
  };

  if (cacheSuccess) {
    // Don't wait for this to finish since we just put a
    // simulated response in the cache. TODO: retry on fail
    fetch(url, options).then((res) => {
      if (res.status >= 200 && res.status < 300) {
        successfullyPersistedContexts.add(hash);
      }
    });
  } else {
    // We were unable to cache so we should wait for the round trip.
    const res = await fetch(url, options);

    if (res.status < 200 || res.status > 299) {
      throw new Error("Bad request");
    } else {
      successfullyPersistedContexts.add(hash);
    }
  }

  return hash;
}

export async function fetchContext(
  hash: string
): Promise<DataExplorerContext | DataExplorerContextV2> {
  let cache: Cache | undefined;
  let response: Response | undefined;
  const request = new Request(getContextUrl(hash));

  try {
    // window.caches.open() will throw an error in Firefox when the user is in
    // "private browsing mode."
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1724607
    // https://support.mozilla.org/en-US/kb/private-browsing-use-firefox-without-history
    cache = await window.caches.open(CONTEXT_CACHE);
    response = await cache.match(request.clone());
  } catch (e) {
    window.console.error(e);

    if (fallbackInMemoryCache[hash]) {
      return fallbackInMemoryCache[hash];
    }
  }

  if (response && response.status > 299) {
    window.console.warn(
      `Context with hash "${hash}" was cached with status code ${response.status}!`
    );

    // Clear out this useless response because it's effectively a cache miss
    response = undefined;
  }

  // handle cache miss
  if (!response) {
    response = await fetch(request.clone());

    if (cache) {
      await cache.put(request, response.clone());
    }
  }

  if (response.status === 404) {
    throw new Error("Context not found.");
  }

  if (response.status >= 400) {
    throw new Error("Error fetching context.");
  }

  let body = await response.json();

  // A response was returned but it wasn't formatted as expected.
  if (!("value" in body)) {
    // Retry the request against the legacy Portal API (Breadbox is supposed to
    // do this automatically but sometimes it doesn't work).
    if (isBreadboxOnlyMode && !isElara) {
      window.console.warn(`Request failed: ${JSON.stringify(body)}.`);
      window.console.warn("Retrying the request using the legacy Portal API.");

      const url = new URL(request.url);
      url.pathname = url.pathname.replace("/breadbox/temp/", "/");

      const newRequest = new Request(url.toString(), request);
      response = await fetch(newRequest);
      body = await response.json();

      if (!("value" in body)) {
        throw new Error(JSON.stringify(body));
      } else {
        window.console.warn("Success!");
      }
    } else {
      throw new Error(JSON.stringify(body));
    }
  }

  const context = JSON.parse(body.value);

  if (!context) {
    throw new Error(`Cound not fetch context from unknown hash "${hash}".`);
  }

  if (!cache) {
    fallbackInMemoryCache[hash] = context;
  }

  return context;
}
