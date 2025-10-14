import * as Papa from "papaparse";
import { FailedCeleryTask } from "@depmap/compute";
import {
  AddCustDatasetArgs,
  AddDatasetOneRowArgs,
  Dataset,
  DatasetUpdateArgs,
  DatasetValueType,
  ErrorTypeError,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  SliceQuery,
  TabularDatasetDataArgs,
} from "@depmap/types";
import { UploadTask, UploadTaskUserError } from "@depmap/user-upload";
import { uri } from "../../uriTemplateTag";
import { getJson, postJson, deleteJson, postMultipart } from "../client";

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

export function getDataset(datasetId: string) {
  return getJson<Dataset>(uri`/datasets/${datasetId}`);
}

export function deleteDataset(id: string) {
  // TODO: Figure out return type.
  return deleteJson<unknown>("/datasets/", id);
}

export function updateDataset(
  datasetId: string,
  datasetUpdateArgs: DatasetUpdateArgs
) {
  return postJson<Dataset>(uri`/datasets/${datasetId}`, datasetUpdateArgs);
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
      aggregation: "mean" | "median" | "25%tile" | "75%tile";
    };
  }
) {
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

const assertCsvSingleColumnNoHeader = (
  dataRow: any[],
  index: number
): UploadTaskUserError | null => {
  if (dataRow.length > 2) {
    return {
      message: "File has too many columns",
    };
  }

  if (index === 0) {
    if (dataRow[0] === undefined || dataRow[0] === null || dataRow[0] === "") {
      return {
        message:
          "Index of first row is NaN. Please upload a file without a header.",
      };
    }
  }

  return null;
};

const parseFileToAddHeader = (rawFile: any, headerStr: string) => {
  return new Promise<any>((resolve, reject) => {
    Papa.parse(rawFile, {
      complete: (results) => {
        results.data.map((val, index) => {
          const error = assertCsvSingleColumnNoHeader(val, index);
          if (error) {
            reject(new Error(error.message));
          }

          return error;
        });

        results.data.splice(0, 0, ["", headerStr]);

        resolve(results.data);
      },
    });
  });
};

export function postCustomCsv(config: {
  displayName: string;
  units: string;
  transposed: boolean;
  uploadFile: File;
}) {
  const { displayName, units, transposed, uploadFile } = config;

  if (!transposed) {
    throw new Error(
      "Uploading CSV with cell lines as columns is not currently supported."
    );
  }

  const args = {
    name: displayName,
    units,
    data_type: "user_upload",
    sample_type: "depmap_model",
    feature_type: undefined,
    value_type: DatasetValueType.continuous,
    data_file: uploadFile,
    is_transient: true,
  };

  return postMultipart<UploadTask>("/datasets/", args);
}

export function postCustomCsvOneRow(
  config: AddDatasetOneRowArgs
): Promise<UploadTask> {
  const { uploadFile } = config;
  const { name } = uploadFile;

  return parseFileToAddHeader(config.uploadFile, "custom data")
    .then((parsedFile) => {
      const unparsedFile = Papa.unparse(parsedFile);
      const finalUploadFile = new Blob([unparsedFile], {
        type: "text/csv",
      });

      const finalConfig: Readonly<AddCustDatasetArgs> = {
        name,
        units: "float",
        data_type: "user_upload",
        sample_type: "depmap_model",
        feature_type: null,
        value_type: DatasetValueType.continuous,
        data_file: finalUploadFile,
        is_transient: true,
      };

      return postMultipart<UploadTask>("/datasets/", finalConfig);
    })
    .catch((error: Error) => {
      const failedUploadTask: FailedCeleryTask = {
        id: "",
        message: error.message,
        nextPollDelay: 1000,
        percentComplete: undefined,
        result: undefined,
        state: "FAILURE",
      };

      return failedUploadTask;
    });
}
