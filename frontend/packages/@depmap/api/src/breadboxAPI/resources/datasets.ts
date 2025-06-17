import * as Papa from "papaparse";
import { FailedCeleryTask } from "@depmap/compute";
import {
  AddCustDatasetArgs,
  AddDatasetOneRowArgs,
  Dataset,
  DatasetUpdateArgs,
  DatasetValueType,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  TabularDatasetDataArgs,
} from "@depmap/types";
import { UploadTask, UploadTaskUserError } from "@depmap/user-upload";
import { getJson, postJson, deleteJson, postMultipart } from "../client";

export function getDatasets() {
  return getJson<Dataset[]>("/datasets/");
}

export function deleteDataset(id: string) {
  // TODO: Figure out return type.
  return deleteJson<any>("/datasets/", id);
}

export function updateDataset(
  datasetId: string,
  datasetUpdateArgs: DatasetUpdateArgs
) {
  return postJson<Dataset>(`/datasets/${datasetId}`, datasetUpdateArgs);
}

export function getTabularDatasetData(
  datasetId: string,
  args: TabularDatasetDataArgs
) {
  const url = `/datasets/tabular/${datasetId}`;
  return postJson<{ [key: string]: Record<string, any> }>(url, args);
}

export function getDatasetFeatures(datasetId: string) {
  return getJson<{ id: string; label: string }[]>(
    `/datasets/features/${datasetId}`
  );
}

export function getMatrixDatasetFeaturesData(
  datasetId: string,
  featureIds: string[]
): Promise<{ [key: string]: Record<string, any> }> {
  const url = `/datasets/matrix/${datasetId}`;

  const args = {
    features: featureIds,
    feature_identifier: "id",
  };
  return postJson<{ [key: string]: Record<string, any> }>(url, args);
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
        feature_type: "generic",
        sample_type: "depmap_model",
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
