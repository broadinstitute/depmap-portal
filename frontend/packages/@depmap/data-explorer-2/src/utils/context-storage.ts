import stableStringify from "json-stable-stringify";
import { enabledFeatures } from "@depmap/globals";
import { DataExplorerContext, DataExplorerContextV2 } from "@depmap/types";
import getContextHash from "./get-context-hash";

function fetchUrlPrefix() {
  // HACK: Detect when Elara is being served behind Depmap portal proxy
  if (window.location.pathname.includes("/breadbox/elara")) {
    return window.location.pathname.replace(/\/elara\/.*$/, "");
  }

  const element = document.getElementById("webpack-config");

  if (element) {
    const webpackConfig = JSON.parse(element!.textContent as string);
    return webpackConfig.rootUrl;
  }

  return "/";
}

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
// In the legacy Portal, these are persisted to an S3 bucket. Elara uses
// Breadbox which implements the same set of endpoints but stores them in its
// database instead.
const getCasUrl = () => {
  const prefix = fetchUrlPrefix().replace(/^\/$/, "");

  return enabledFeatures.elara ? `${prefix}/temp/cas` : `${prefix}/cas`;
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

  const url = enabledFeatures.elara ? getCasUrl() : `${getCasUrl()}/`;
  const options = {
    method: "POST",
    headers: enabledFeatures.elara
      ? {
          Accept: "application/json",
          "Content-Type": "application/json",
        }
      : {
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
    body: enabledFeatures.elara
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

  const body = await response.json();
  const context = JSON.parse(body.value);

  if (!cache) {
    fallbackInMemoryCache[hash] = context;
  }

  return context;
}
