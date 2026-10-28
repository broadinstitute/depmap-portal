import {
  Dataset,
  DatasetUpdateArgs,
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

// Breadbox's AggregationMethod enum, mirrored. Kept as a named type because
// the runtime guard below has to enumerate it too, and the two must not drift.
export type BreadboxAggregation =
  | "mean"
  | "median"
  | "25%tile"
  | "75%tile"
  | "stddev"
  | "variance"
  | "count"
  | "sum";

const VALID_AGGREGATIONS: BreadboxAggregation[] = [
  "mean",
  "median",
  "25%tile",
  "75%tile",
  "stddev",
  "variance",
  "count",
  "sum",
];

export function getMatrixDatasetData(
  datasetId: string,
  args: {
    sample_identifier?: "id" | "label";
    feature_identifier?: "id" | "label";
    samples?: string[] | null;
    features?: string[] | null;
    aggregate?: {
      aggregate_by: "features" | "samples";
      // One method, or several. Several are worth asking for together when they
      // describe the same collapse (a spread alongside the `count` it was
      // computed over), since the cost is reading the block out of HDF5, not
      // the arithmetic. The response is keyed by method name either way.
      aggregation: BreadboxAggregation | BreadboxAggregation[];
    };
  }
) {
  checkDatasetId(datasetId);

  if (!args.sample_identifier && !args.feature_identifier) {
    throw new Error(
      "Must supply at least a `sample_identifier` or `feature_identifier`"
    );
  }

  // Defensive trap: reject any aggregation Breadbox can't perform before it
  // reaches the server, where it would otherwise fail opaquely. The param type
  // already restricts `aggregation` to Breadbox's set, so this only fires when
  // a caller has cast around the types. In particular it catches the Data
  // Explorer "expansion" sentinel (and "first"/"correlation") — app-layer
  // concepts that must be resolved upstream, never forwarded here.
  if (args.aggregate) {
    const requested = Array.isArray(args.aggregate.aggregation)
      ? args.aggregate.aggregation
      : [args.aggregate.aggregation];

    const unsupported = (requested as string[]).find(
      (agg) => !VALID_AGGREGATIONS.includes(agg as BreadboxAggregation)
    );

    if (unsupported !== undefined) {
      throw new Error(
        `getMatrixDatasetData received aggregation "${unsupported}", which ` +
          `Breadbox does not support (valid: ${VALID_AGGREGATIONS.join(
            ", "
          )}). ` +
          `Values like "first", "correlation", or the Data Explorer "expansion" ` +
          `sentinel must be resolved before reaching this call.`
      );
    }
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

  return postJson<{
    [key: string]: Record<string, any>;
  }>(uri`/datasets/tabular/${datasetId}`, args);
}

export async function getDatasetSamples(datasetId: string) {
  checkDatasetId(datasetId);

  return getJson<{ id: string; label: string }[]>(
    uri`/datasets/samples/${datasetId}`
  );
}

export async function getDatasetFeatures(datasetId: string) {
  checkDatasetId(datasetId);

  return getJson<{ id: string; label: string }[]>(
    uri`/datasets/features/${datasetId}`
  );
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

// `indices` restricts a tabular column to the given dimension IDs, for a caller
// that already knows which rows it will show. It is a separate argument rather
// than a SliceQuery field on purpose: SliceQuery is serialized into saved links
// and remembered table columns, and column identity is derived from it, so a row
// set must not be able to change either. It still reaches the persistent cache
// key, since the key is the whole POST body -- one entry per row set.
//
// `options.fields` narrows the response to the listed keys; it is how a caller that
// already has the row labels (or never shows them) avoids paying for them on the
// wire. Like `indices` it is not part of SliceQuery, and it reaches the persistent
// cache key through the POST body, so narrowed and full responses never collide.
type DimensionDataField = "ids" | "labels" | "values";
type DimensionDataResponse = {
  ids: string[];
  labels: string[];
  values: string[];
};

export function getDimensionData(
  sliceQuery: SliceQuery,
  indices?: string[]
): Promise<DimensionDataResponse>;
export function getDimensionData<F extends DimensionDataField>(
  sliceQuery: SliceQuery,
  indices: string[] | undefined,
  options: { fields: F[] }
): Promise<Pick<DimensionDataResponse, F>>;
export function getDimensionData(
  sliceQuery: SliceQuery,
  indices?: string[],
  options?: { fields: DimensionDataField[] }
) {
  return postJson<Partial<DimensionDataResponse>>("/datasets/dimension/data/", {
    ...sliceQuery,
    ...(indices ? { indices } : {}),
    ...(options ? { fields: options.fields } : {}),
  });
}
