import {
  DataExplorerAnonymousContext,
  DataExplorerDatasetDescriptor,
} from "@depmap/types";

function fetchUrlPrefix() {
  const element = document.getElementById("webpack-config");

  if (element) {
    const webpackConfig = JSON.parse(element!.textContent as string);
    return webpackConfig.rootUrl;
  }

  return "/";
}

const urlPrefix = `${fetchUrlPrefix().replace(/^\/$/, "")}/data_explorer_2`;
const fetchJsonCache: Record<string, Promise<unknown> | null> = {};

const fetchJson = async <T>(
  url: string,
  transformResponse: (o: object) => T = (id) => id as T
): Promise<T> => {
  if (!fetchJsonCache[url]) {
    fetchJsonCache[url] = new Promise((resolve, reject) => {
      fetch(urlPrefix + url, { credentials: "include" })
        .then((response) => {
          return response.json().then((body) => {
            if (response.status >= 200 && response.status < 300) {
              const result = transformResponse(body);
              fetchJsonCache[url] = Promise.resolve(result);
              resolve(result);
            } else {
              fetchJsonCache[url] = null;
              reject(body);
            }
          });
        })
        .catch((e) => {
          fetchJsonCache[url] = null;
          reject(e);
        });
    });
  }

  return fetchJsonCache[url] as Promise<T>;
};

const postJson = async <T>(url: string, obj: unknown): Promise<T> => {
  const json = JSON.stringify(obj);
  const cacheKey = `${url}-${json}`;

  if (!fetchJsonCache[cacheKey]) {
    fetchJsonCache[cacheKey] = new Promise((resolve, reject) => {
      fetch(urlPrefix + url, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: json,
      })
        .then((response) => {
          return response.json().then((body) => {
            if (response.status >= 200 && response.status < 300) {
              fetchJsonCache[cacheKey] = Promise.resolve(body);
              resolve(body);
            } else {
              fetchJsonCache[cacheKey] = null;
              reject(body);
            }
          });
        })
        .catch((e) => {
          fetchJsonCache[cacheKey] = null;
          reject(e);
        });
    });
  }

  return fetchJsonCache[cacheKey] as Promise<T>;
};

export function fetchDatasetsByIndexType() {
  return fetchJson<Record<string, DataExplorerDatasetDescriptor[]>>(
    `/datasets_by_index_type`
  );
}

export function fetchDatasetsMatchingContextIncludingEntities(
  context: DataExplorerAnonymousContext
): Promise<
  {
    dataset_id: string;
    dataset_label: string;
    dimension_labels: string[];
  }[]
> {
  return postJson("/context/datasets", { context });
}
