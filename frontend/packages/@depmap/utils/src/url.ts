import { Buffer } from "buffer";

export function setQueryStringWithoutPageReload(
  key: string,
  value: any,
  replace = false
) {
  const url = new URL(window.location.href);

  url.searchParams.set(key, value);

  if (replace) {
    window.history.replaceState({ path: url.href }, "", url.href);
  } else {
    window.history.pushState({ path: url.href }, "", url.href);
  }
}

/**
 * Updates the URL without a page reload.
 * For large lists, it uses a single compressed 'glist' param.
 */
export function setQueryStringListWithoutPageReload(
  key: string,
  value: string | string[],
  replace = false
) {
  const url = new URL(window.location.href);
  const URL_LIMIT = 1800; // Leave buffer for domain and other params

  // 1. Clear existing list-related keys to start fresh
  url.searchParams.delete(key);
  url.searchParams.delete("glist");

  if (Array.isArray(value) && value.length > 0) {
    // Determine if we should compress based on total length
    const estimatedLength = value.reduce(
      (acc, g) => acc + g.length + key.length + 2,
      0
    );

    if (estimatedLength > URL_LIMIT) {
      // COMPRESSION: Base64 encode for very long lists
      const compressed = Buffer.from(value.join(",")).toString("base64");
      url.searchParams.set("glist", compressed);
    } else {
      // STANDARD: Repeats key for each item: ?genes=SOX10&genes=KRAS
      value.forEach((item) => {
        if (item && item.trim()) {
          url.searchParams.append(key, item.trim());
        }
      });
    }
  } else if (typeof value === "string" && value.trim()) {
    // Handle single string input
    url.searchParams.set(key, value.trim());
  }

  // 2. Update the browser history
  const state = { path: url.href };
  if (replace) {
    window.history.replaceState(state, "", url.href);
  } else {
    window.history.pushState(state, "", url.href);
  }
}

// So far, just used to set the query params for the AllDownloads modal urls
export function setQueryStringsWithoutPageReload(
  keyVal: [string, string][],
  replace = false
) {
  const url = new URL(window.location.href);

  const processedKeyVals = keyVal.map((element) => {
    if (element[0] === "filename" && url.searchParams.has("file")) {
      return ["file", element[1]];
    }

    if (element[0] === "releasename" && url.searchParams.has("release")) {
      return ["release", element[1]];
    }

    return element;
  });

  processedKeyVals.forEach((element) => {
    url.searchParams.set(element[0], element[1]);
  });

  if (replace) {
    window.history.replaceState({ path: url.href }, "", url.href);
  } else {
    window.history.pushState({ path: url.href }, "", url.href);
  }
}

export function deleteQueryParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("releasename");
  url.searchParams.delete("filename");
  url.searchParams.delete("release");
  url.searchParams.delete("file");

  window.history.pushState({ path: url.href }, "", url.href);
}

export function deleteSpecificQueryParams(params: string[]) {
  const url = new URL(window.location.href);

  params.forEach((param) => {
    url.searchParams.delete(param);
  });

  window.history.pushState({ path: url.href }, "", url.href);
}
