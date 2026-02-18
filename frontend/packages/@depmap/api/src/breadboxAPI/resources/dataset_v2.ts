import SparkMD5 from "spark-md5";
import * as Papa from "papaparse";
import { FailedCeleryTask } from "@depmap/compute";
import {
  AddDatasetOneRowArgs,
  DatasetParams,
  DatasetValueType,
  MatrixDatasetParams,
} from "@depmap/types";
import { UploadTask, UploadTaskUserError } from "@depmap/user-upload";
import { postJson, postMultipart } from "../client";

interface AddDatasetResponse {
  state: string;
  id: string;
  message?: string | null;
  result?: Record<string, unknown> | null;
  percentComplete?: number | null;
}

export function postDatasetUpload(datasetParams: DatasetParams) {
  return postJson<AddDatasetResponse>("/dataset-v2/", datasetParams);
}

async function uploadFile(file: File | Blob): Promise<string> {
  const response = await postMultipart<{ file_id: string }>("/uploads/file", {
    file,
  });

  return response.file_id;
}

/**
 * Compute the MD5 hex digest of a File or Blob.
 *
 * Uses SparkMD5's incremental/chunked API to avoid loading
 * the entire file into memory at once.
 */
export function computeFileMd5(
  file: File | Blob,
  chunkSize = 2 * 1024 * 1024 // 2MB chunks
): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;

    const loadNextChunk = () => {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      reader.readAsArrayBuffer(file.slice(start, end));
    };

    reader.onload = (e) => {
      if (e.target?.result) {
        spark.append(e.target.result as ArrayBuffer);
      }

      currentChunk += 1;

      if (currentChunk < totalChunks) {
        loadNextChunk();
      } else {
        resolve(spark.end());
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file for MD5 computation"));
    };

    if (file.size === 0) {
      // MD5 of empty input
      resolve(spark.end());
    } else {
      loadNextChunk();
    }
  });
}

async function createDatasetV2(
  file: File | Blob,
  params: Omit<
    MatrixDatasetParams,
    "file_ids" | "dataset_md5" | "priority" | "taiga_id" | "allowed_values"
  >
) {
  const [fileId, md5] = await Promise.all([
    uploadFile(file),
    computeFileMd5(file),
  ]);

  const payload: MatrixDatasetParams = {
    ...params,
    file_ids: [fileId],
    dataset_md5: md5 as any,
    priority: null,
    taiga_id: null,
    allowed_values: null,
  };

  return postJson<AddDatasetResponse>("/dataset-v2/", payload);
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

function taskResponseToUploadTask(response: AddDatasetResponse): UploadTask {
  if (response.state === "SUCCESS") {
    return {
      id: response.id,
      state: "SUCCESS",
      nextPollDelay: 0,
      percentComplete: 100,
      result: {
        datasetId: response.result?.datasetId as string,
        warnings: (response.result?.warnings as string[]) || [],
        dataset: response.result?.dataset,
      },
      message: response.message || "",
    };
  }

  if (response.state === "FAILURE") {
    return {
      id: response.id,
      state: "FAILURE",
      nextPollDelay: 1000,
      percentComplete: undefined,
      result: undefined,
      message: response.message || "Dataset creation failed",
    } as FailedCeleryTask;
  }

  // PENDING or PROGRESS — the caller may need to poll /api/task/{id}
  return {
    id: response.id,
    state: response.state as "PENDING",
    nextPollDelay: 1000,
    percentComplete: undefined,
    result: undefined,
    message: response.message || "",
  } as UploadTask;
}

export async function postCustomCsv(config: {
  displayName: string;
  units: string;
  transposed: boolean;
  uploadFile: File;
}): Promise<UploadTask> {
  const { displayName, units, transposed, uploadFile: file } = config;

  if (!transposed) {
    throw new Error(
      "Uploading CSV with cell lines as columns is not currently supported."
    );
  }

  try {
    const response = await createDatasetV2(file, {
      name: displayName,
      units,
      data_type: "user_upload",
      sample_type: "depmap_model",
      feature_type: null as any,
      value_type: DatasetValueType.continuous,
      is_transient: true,
      format: "matrix",
      group_id: "11111111-1111-1111-1111-111111111111", // transient file group
    });

    return taskResponseToUploadTask(response);
  } catch (error: any) {
    return {
      id: "",
      message: error.message || "Upload failed",
      nextPollDelay: 1000,
      percentComplete: undefined,
      result: undefined,
      state: "FAILURE",
    } as FailedCeleryTask;
  }
}

export async function postCustomCsvOneRow(
  config: AddDatasetOneRowArgs
): Promise<UploadTask> {
  const { uploadFile: rawFile } = config;

  if (!rawFile) {
    return {
      id: "",
      message: "No file provided",
      nextPollDelay: 1000,
      percentComplete: undefined,
      result: undefined,
      state: "FAILURE",
    } as FailedCeleryTask;
  }

  const { name } = rawFile;

  try {
    const parsedData = await parseFileToAddHeader(rawFile, "custom data");
    const csvString = Papa.unparse(parsedData);
    const csvBlob = new Blob([csvString], { type: "text/csv" });

    const response = await createDatasetV2(csvBlob, {
      name,
      units: "float",
      data_type: "user_upload",
      sample_type: "depmap_model",
      feature_type: null as any,
      value_type: DatasetValueType.continuous,
      is_transient: true,
      format: "matrix",
      group_id: "11111111-1111-1111-1111-111111111111", // transient file group
    });

    return taskResponseToUploadTask(response);
  } catch (error: any) {
    return {
      id: "",
      message: error.message || "Upload failed",
      nextPollDelay: 1000,
      percentComplete: undefined,
      result: undefined,
      state: "FAILURE",
    } as FailedCeleryTask;
  }
}
