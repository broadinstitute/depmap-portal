import {
  DataExplorerContextV2,
  DataExplorerContextVariable,
  DataExplorerDatasetDescriptor,
  Dataset,
  DimensionType,
  MatrixDataset,
} from "@depmap/types";

let urlPrefix = "";

// HACK: Detect when Elara is being served behind Depmap portal proxy
if (window.location.pathname.includes("/breadbox/elara")) {
  urlPrefix = window.location.pathname.replace(/\/elara\/.*$/, "");
}

const fetchJsonCache: Record<string, Promise<unknown> | null> = {};

const fetchJson = async <T>(url: string): Promise<T> => {
  if (!fetchJsonCache[url]) {
    fetchJsonCache[url] = new Promise((resolve, reject) => {
      fetch(urlPrefix + url, { credentials: "include" })
        .then((response) => {
          return response.json().then((body) => {
            if (response.status >= 200 && response.status < 300) {
              fetchJsonCache[url] = Promise.resolve(body);
              resolve(body);
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
  const { dataset_id, identifier, identifier_type } = variable;
  const sliceQuery = { dataset_id, identifier, identifier_type };

  const data = await postJson<{
    values: (string | string[] | number | null)[];
  }>("/datasets/dimension/data/", sliceQuery);

  if (!("values" in data)) {
    window.console.error({
      sliceQuery,
      response: data,
    });
    throw new Error(
      "Bad response from /datasets/dimension/data/. Contains no `values!`"
    );
  }

  if (variable.value_type === "text" || variable.value_type === "categorical") {
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

export function fetchDatasets() {
  return fetchJson<Dataset[]>("/datasets/");
}

let datasetsByIndexType: Record<
  string,
  DataExplorerDatasetDescriptor[]
> | null = null;

export async function fetchDatasetsByIndexType() {
  if (datasetsByIndexType) {
    return datasetsByIndexType;
  }

  const datasets = await fetchDatasets();
  datasetsByIndexType = {};

  datasets.forEach((dataset) => {
    if (dataset.format !== "matrix_dataset") {
      return;
    }

    if (dataset.value_type !== "continuous") {
      return;
    }

    const md = dataset as MatrixDataset;

    const commonProperties = {
      data_type: md.data_type,
      dataset_id: md.id,
      given_id: md.given_id,
      label: md.name,
      priority: md.priority,
      units: md.units,
    };

    datasetsByIndexType![md.sample_type_name] = [
      ...(datasetsByIndexType![md.sample_type_name] || []),
      {
        ...commonProperties,
        index_type: md.sample_type_name,
        slice_type: md.feature_type_name,
      },
    ];

    datasetsByIndexType![md.feature_type_name] = [
      ...(datasetsByIndexType![md.feature_type_name] || []),
      {
        ...commonProperties,
        index_type: md.feature_type_name,
        slice_type: md.sample_type_name,
      },
    ];
  });

  return datasetsByIndexType;
}

export function fetchDimensionTypes() {
  return fetchJson<DimensionType[]>("/types/dimensions");
}

// TODO: Rewrite this to use /types/dimensions/{name}/identifiers
export async function fetchDimensionIdentifiers(dimensionTypeName: string) {
  const dimensionTypes = await fetchDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  const data = await postJson<{
    ids: string[];
    // labels: string[];
    values: string[];
  }>("/datasets/dimension/data/", {
    dataset_id: dimType.metadata_dataset_id,
    // HACK: There's a bug where the labels we get are actually ids! We'll
    // request "label" as the identifier instead.
    identifier: "label",
    identifier_type: "column",
  });

  return data.ids
    .map((id, index) => ({ id, label: data.values[index] }))
    .sort((a, b) => (a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1));
}
