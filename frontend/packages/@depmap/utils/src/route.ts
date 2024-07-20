import encodeParams from "./encodeParams";

export function encodeUrl(params: {
  [key: string]: string | number | boolean;
}) {
  // encodes url params to the current url
  const url = `${
    window.location.origin + window.location.pathname
  }?${encodeParams(params)}`;
  return url;
}

function decode(x: string) {
  return decodeURIComponent(x).replace(/\+/g, " ");
}

export function getQueryParams(multipleValuesParams: Set<string> = new Set()) {
  const params: { [key: string]: string | Set<string> } = {};
  const href = window.location.search;

  const queryString = href.split("?").pop();

  if (!queryString) {
    return params;
  }

  const pairs = queryString.split("&");

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i].split("=");
    const key = decode(p[0]);
    const value = decode(p[1]);
    if (multipleValuesParams.has(key)) {
      if (key in params) {
        const existingValues: Set<string> = params[key] as Set<string>;
        existingValues.add(value);
      } else {
        params[key] = new Set([value]);
      }
    } else {
      params[key] = value;
    }
  }

  return params;
}
