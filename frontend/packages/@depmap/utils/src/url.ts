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
