import qs from "qs";
import {
  AnnotationType,
  DataExplorerContextV2,
  DataExplorerContextVariable,
  Dataset,
  DimensionType,
  SliceQuery,
} from "@depmap/types";
import { compareCaseInsensitive } from "@depmap/utils";

let urlPrefix = "";

// HACK: Detect when Elara is being served behind Depmap portal proxy
if (window.location.pathname.includes("/breadbox/elara")) {
  urlPrefix = window.location.pathname.replace(/\/elara\/.*$/, "");
}

const fetchJsonCache: Record<string, Promise<unknown> | null> = {};

export const fetchJson = async <T>(url: string): Promise<T> => {
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

export const postJson = async <T>(url: string, obj: unknown): Promise<T> => {
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
        // aren't part of the SliceQuery format. We'll only include the
        // relevant fields so the backend doesn't get confused.
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

  const response = await postJson<
    | {
        ids: string[];
        labels: string[];
        num_candidates: number;
      }
    // WORKAROUND: Errors result in a code 200 like regular responses.
    // We'll look for detail property to detect them.
    | { detail: string }
  >("/temp/context", contextToEval);

  if ("detail" in response) {
    window.console.warn("Could not evaluate context", context);
    throw new Error(response.detail);
  }

  return response;
}

export function fetchDatasets(
  options?: Partial<{
    feature_id: string;
    feature_type: string;
    sample_id: string;
    sample_type: string;
  }>
) {
  let url = "/datasets/";

  if (options) {
    url += `?${qs.stringify(options)}`;
  }

  return fetchJson<Dataset[]>(url);
}

export async function fetchVariableDomain(
  variable: DataExplorerContextVariable
) {
  const { dataset_id, identifier, identifier_type } = variable;
  const sliceQuery = { dataset_id, identifier, identifier_type };
  let value_type: AnnotationType | undefined;

  const datasets = await fetchDatasets();
  const dataset = datasets.find((d) => {
    return d.id === dataset_id || d.given_id === dataset_id;
  });

  if (dataset && dataset.format === "matrix_dataset") {
    value_type = dataset.value_type as AnnotationType;
  }

  if (dataset && dataset.format === "tabular_dataset") {
    if (identifier_type !== "column") {
      throw new Error(
        `Can't look up identifier_type "${identifier_type}"` +
          "in a tabular dataset!"
      );
    }

    const column = dataset.columns_metadata[identifier];

    if (!column) {
      throw new Error(
        `Column "${identifier}" not found in dataset "${dataset.id}".`
      );
    }

    value_type = column.col_type;
  }

  let data = {
    values: [] as (string | string[] | number | null)[],
  };

  try {
    data = await postJson<{
      values: (string | string[] | number | null)[];
    }>("/datasets/dimension/data/", sliceQuery);
  } catch {
    window.console.error({ sliceQuery });
    throw new Error("Error fetching data from slice query");
  }

  if (!("values" in data)) {
    window.console.error({
      sliceQuery,
      response: data,
    });
    throw new Error(
      "Bad response from /datasets/dimension/data/. Contains no `values!`"
    );
  }

  if (value_type === "text" || value_type === "categorical") {
    const stringValues = data.values.filter(
      (val) => typeof val === "string"
    ) as string[];

    return Promise.resolve({
      unique_values: [...new Set(stringValues)].sort(compareCaseInsensitive),
      value_type,
    });
  }

  if (value_type === "continuous") {
    const numberValues = data.values.filter(
      (val) => typeof val === "number"
    ) as number[];

    return Promise.resolve({
      min: Math.min(...numberValues),
      max: Math.max(...numberValues),
      value_type,
    });
  }

  throw new Error(`Unsupported value_type "${value_type}".`);
}

export function fetchDimensionTypes() {
  return fetchJson<DimensionType[]>("/types/dimensions");
}

type Identifiers = { id: string; label: string }[];

export async function fetchDimensionIdentifiers(
  dimensionTypeName: string,
  dataType?: string
) {
  const dimensionTypes = await fetchDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  const queryParams: string[] = [];

  if (dataType) {
    queryParams.push(`data_type=${dataType}`);
  }

  // FIXME: This query param makes things incredibly slow. I'm commenting it
  // out for now because it might not be adding much value. Only about 8% of
  // genes are not represented in a dataset somewhere.
  // queryParams.push("show_only_dimensions_in_datasets=true");

  const url =
    `/types/dimensions/${dimensionTypeName}/identifiers` +
    (queryParams.length ? `?` : "") +
    queryParams.join("&");

  return fetchJson<Identifiers>(url);
}

export async function fetchDatasetIdentifiers(
  dimensionTypeName: string,
  dataset_id: string
) {
  const dimensionTypes = await fetchDimensionTypes();
  const dimType = dimensionTypes.find((t) => t.name === dimensionTypeName);

  if (!dimType) {
    throw new Error(`Unrecognized dimension type "${dimensionTypeName}"!`);
  }

  const featuresOrSamples = dimType.axis === "feature" ? "features" : "samples";

  return fetchJson<Identifiers>(`/datasets/${featuresOrSamples}/${dataset_id}`);
}

export async function fetchAssociations(sliceQuery: SliceQuery) {
  return postJson<{
    dataset_name: string;
    dimension_label: string;
    associated_datasets: {
      name: string;
      dimension_type: string;
      dataset_id: string;
    }[];
    associated_dimensions: {
      correlation: number;
      log10qvalue: number;
      other_dataset_id: string;
      other_dimension_given_id: string;
      other_dimension_label: string;
    }[];
  }>("/temp/associations/query-slice", sliceQuery);
}
