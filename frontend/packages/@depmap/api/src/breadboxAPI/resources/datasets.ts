import {
  Dataset,
  DatasetUpdateArgs,
  ErrorTypeError,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  SliceQuery,
  TabularDatasetDataArgs,
} from "@depmap/types";
import { uri } from "../../uriTemplateTag";
import { getJson, patchJson, postJson, deleteJson } from "../client";

export function getDatasets(
  params?: Partial<{
    feature_id: string;
    feature_type: string;
    sample_id: string;
    sample_type: string;
  }>
) {
  return getJson<Dataset[]>("/datasets/", params);
}

const checkDatasetId = (id: string) => {
  if (id.includes("/")) {
    throw new Error(
      `given_id "${id}" contains a slash! Breadbox does not support this.`
    );
  }
};

export function getDataset(datasetId: string) {
  checkDatasetId(datasetId);
  return getJson<Dataset>(uri`/datasets/${datasetId}`);
}

export function deleteDataset(datasetId: string) {
  checkDatasetId(datasetId);
  return deleteJson<{ message: string }>(uri`/datasets/${datasetId}`);
}

export function updateDataset(
  datasetId: string,
  datasetUpdateArgs: DatasetUpdateArgs
) {
  checkDatasetId(datasetId);
  return patchJson<Dataset>(uri`/datasets/${datasetId}`, datasetUpdateArgs);
}

export function getMatrixDatasetData(
  datasetId: string,
  args: {
    sample_identifier?: "id" | "label";
    feature_identifier?: "id" | "label";
    samples?: string[] | null;
    features?: string[] | null;
    aggregate?: {
      aggregate_by: "features" | "samples";
      aggregation: "mean" | "median" | "25%tile" | "75%tile" | "stddev";
    };
  }
) {
  checkDatasetId(datasetId);

  if (!args.sample_identifier && !args.feature_identifier) {
    throw new Error(
      "Must supply at least a `sample_identifier` or `feature_identifier`"
    );
  }

  const finalArgs: typeof args = { ...args };

  // WORKAROUND: `aggregate` is silently ignored if you don't
  // defined both dimensions (merely passing `null` is enough).
  if (args.aggregate) {
    if (!args.samples) {
      finalArgs.samples = null;
    }

    if (!args.features) {
      finalArgs.features = null;
    }
  }

  return postJson<{ [key: string]: Record<string, any> }>(
    uri`/datasets/matrix/${datasetId}`,
    finalArgs
  );
}

export async function getTabularDatasetData(
  datasetId: string,
  args: TabularDatasetDataArgs
) {
  checkDatasetId(datasetId);

  const result = await postJson<{
    [key: string]: Record<string, any>;
  }>(uri`/datasets/tabular/${datasetId}`, args);

  // WORKAROUND: Breadbox responds with a 200 even though there was an error.
  if ("detail" in result) {
    const isErrorObj = typeof result.detail === "object";

    throw new ErrorTypeError({
      errorType: isErrorObj
        ? result.detail.errorType
        : ("UNSPECIFIED_LEGACY_ERROR" as ErrorTypeError["errorType"]),

      message: isErrorObj ? result.detail.message : result.detail,
    });
  }

  return result;
}

export async function getDatasetSamples(datasetId: string) {
  checkDatasetId(datasetId);

  const result = await getJson<{ id: string; label: string }[]>(
    uri`/datasets/samples/${datasetId}`
  );

  if (!Array.isArray(result)) {
    const detail = (result as any).detail;

    throw new ErrorTypeError({
      errorType: detail.error_type,
      message: detail.message,
    });
  }

  return result;
}

export async function getDatasetFeatures(datasetId: string) {
  checkDatasetId(datasetId);

  const result = await getJson<{ id: string; label: string }[]>(
    uri`/datasets/features/${datasetId}`
  );

  if (!Array.isArray(result)) {
    const detail = (result as any).detail;

    throw new ErrorTypeError({
      errorType: detail.error_type,
      message: detail.message,
    });
  }

  return result;
}

export function searchDimensions({
  prefix,
  substring,
  type_name,
  limit,
}: SearchDimenionsRequest) {
  return getJson<SearchDimenionsResponse>("/datasets/dimensions/", {
    prefix,
    substring,
    type_name,
    limit: Number.isFinite(limit) ? limit : 100,
  });
}

export function getDimensionData(sliceQuery: SliceQuery) {
  return postJson<{
    ids: string[];
    labels: string[];
    values: string[];
  }>("/datasets/dimension/data/", sliceQuery);
}
