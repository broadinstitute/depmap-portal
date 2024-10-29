import {
  DataExplorerContextVariable,
  DataExplorerContextV2,
} from "@depmap/types";

let urlPrefix = "";

// HACK: Detect when Elara is being served behind Depmap portal proxy
if (window.location.pathname.includes("/breadbox/elara")) {
  urlPrefix = window.location.pathname.replace(/\/elara\/.*$/, "");
}

const fetchJsonCache: Record<string, Promise<unknown> | null> = {};

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

export async function evaluateContext(
  context: Omit<DataExplorerContextV2, "name">
) {
  const varsAsSliceQueries = Object.fromEntries(
    Object.entries(context.vars).map(([varName, variable]) => [
      varName,
      {
        // The `DataExplorerContextVariable` type has some extra fields that
        // aren't part of the SliceQuery format. We'll strip those out so
        // the backend doesn't get confused.
        dataset_id: variable.dataset_id,
        identifier: variable.identifier,
        identifier_type: variable.identifier_type,
      },
    ])
  );

  const contextToEval = {
    ...context,
    vars: varsAsSliceQueries,
  };

  return postJson<{
    ids: string[];
    labels: string[];
    num_candidates: number;
  }>("/temp/context", contextToEval);
}

export async function fetchVariableDomain(
  variable: DataExplorerContextVariable
) {
  const data = await postJson<{
    values: (string | string[] | number | null)[];
  }>("/datasets/dimension/data/", variable);

  if (variable.value_type === "categorical") {
    const stringValues = data.values.filter(
      (val) => typeof val === "string"
    ) as string[];

    return Promise.resolve({
      unique_values: [...new Set(stringValues)].sort(),
      value_type: variable.value_type,
    });
  }

  if (variable.value_type === "continuous") {
    const numberValues = data.values.filter(
      (val) => typeof val === "number"
    ) as number[];

    return Promise.resolve({
      min: Math.min(...numberValues),
      max: Math.max(...numberValues),
      value_type: variable.value_type,
    });
  }

  throw new Error(`Unsupported value_type "${variable.value_type}".`);
}
