/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/prefer-default-export */
import {
  CeleryTask,
  FailedCeleryTask,
  UnivariateAssociationsParams,
  ComputeResponse,
} from "@depmap/compute";
import {
  AddCustDatasetArgs,
  AddDatasetOneRowArgs,
  AssociationAndCheckbox,
  Dataset,
  DatasetParams,
  DatasetUpdateArgs,
  DatasetValueType,
  DimensionMetadata,
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
  Group,
  GroupArgs,
  GroupEntry,
  GroupEntryArgs,
  InvalidPrioritiesByDataType,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  SliceQueryAssociations,
  UploadFileResponse,
  DatasetAssociations,
} from "@depmap/types";
import { Trace } from "src/trace";
import { UploadTask, UploadTaskUserError } from "@depmap/user-upload";
import { encodeParams } from "@depmap/utils";

import {
  CellignerColorsForCellLineSelector,
  CellLineSelectorLines,
} from "@depmap/cell-line-selector";
import * as Papa from "papaparse";
import {
  DatasetDownloadMetadata,
  ExportDataQuery,
  ExportMergedDataQuery,
  FeatureValidationQuery,
  ValidationResult,
} from "@depmap/data-slicer";

const log = console.debug.bind(console);

export class BreadboxApi {
  urlPrefix: string;

  trace: Trace | null;

  constructor(urlPrefix: string) {
    this.urlPrefix = urlPrefix === "/" ? "" : urlPrefix;
    this.trace = null;
  }

  getTraceParentField() {
    if (this.trace && this.trace.traceID && this.trace.currentSpan) {
      return `00-${this.trace.traceID}-${this.trace.currentSpan.spanID}-01`;
    }
    return null;
  }

  _fetch = <T>(url: string): Promise<T> => {
    const headers: { [key: string]: string } = {};
    const traceParentField = this.getTraceParentField();
    if (traceParentField) {
      headers.traceparent = traceParentField;
    }

    const fullUrl = this.urlPrefix + url;
    log(`fetching ${fullUrl}`);
    return fetch(fullUrl, {
      credentials: "include",
      headers,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  _postMultipart = <T>(url: string, args: any): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`post multipart to ${fullUrl}`);

    const data = new FormData();
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in args) {
      if (Object.prototype.hasOwnProperty.call(args, prop)) {
        data.append(prop, args[prop]);
      }
    }
    return fetch(fullUrl, {
      credentials: "include",
      method: "POST",
      body: data,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject({ body, status: response.status } as {
              body: T;
              status: number;
            });
          }
        );
      }
    );
  };

  _patchMultipart = <T>(url: string, args: any): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`patch multipart to ${fullUrl}`);

    const data = new FormData();
    // eslint-disable-next-line no-restricted-syntax
    for (const prop in args) {
      if (Object.prototype.hasOwnProperty.call(args, prop)) {
        data.append(prop, args[prop]);
      }
    }

    return fetch(fullUrl, {
      credentials: "include",
      method: "PATCH",
      body: data,
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject({ body, status: response.status } as {
              body: T;
              status: number;
            });
          }
        );
      }
    );
  };

  _delete = (url: string, id: string) => {
    const fullUrl = this.urlPrefix + url;
    return fetch(`${fullUrl}/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: id,
    }).then(
      (response: Response): Promise<any> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: string): Promise<any> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  getAssociations(): Promise<AssociationAndCheckbox> {
    return Promise.reject(Error("getAssociations() not implemented"));
  }

  getCellLineUrlRoot(): Promise<string> {
    return Promise.reject(Error("getCellLineUrlRoot() not implemented"));
  }

  getFeedbackUrl(): Promise<string> {
    return Promise.reject(Error("getFeedbackUrl() not implemented"));
  }

  exportData(query: ExportDataQuery): Promise<any> {
    return this._fetchWithJsonBody<any>("/downloads/custom", "POST", query);
  }

  exportDataForMerge(query: ExportMergedDataQuery): Promise<any> {
    return this._fetchWithJsonBody<any>(
      "/downloads/custom_merged",
      "POST",
      query
    );
  }

  validateFeaturesInDataset(
    query: FeatureValidationQuery
  ): Promise<ValidationResult> {
    return this._fetchWithJsonBody<any>(
      "/downloads/data_slicer/validate_data_slicer_features",
      "POST",
      query
    );
  }

  getDatasetsList(): Promise<DatasetDownloadMetadata[]> {
    return this._fetch<DatasetDownloadMetadata[]>("/datasets");
  }

  getDatasets(): Promise<any> {
    return this._fetch<Dataset[]>("/datasets/").then((datasets) =>
      datasets.map(({ id, name }) => ({ label: name, value: id }))
    );
  }

  getDatasetFeatures(
    datasetId: string
  ): Promise<{ id: string; label: string }[]> {
    return this._fetch<{ id: string; label: string }[]>(
      `/datasets/features/${datasetId}`
    );
  }

  getMetadata(label: string): Promise<any> {
    const params: any = {
      label,
    };
    return this._fetch<DimensionMetadata>(`/metadata/?${encodeParams(params)}`);
  }

  getBreadboxUser(): Promise<string> {
    return this._fetch<string>("/user/");
  }

  getBreadboxDatasets(): Promise<Dataset[]> {
    return this._fetch<Dataset[]>("/datasets/");
  }

  deleteDatasets(id: string) {
    return this._delete("/datasets", id);
  }

  updateDataset(
    datasetId: string,
    datasetUpdateArgs: DatasetUpdateArgs
  ): Promise<Dataset> {
    const url = `/datasets/${datasetId}`;
    log(`fetching ${url}`);

    return this._fetchWithJsonBody(url, "PATCH", datasetUpdateArgs);
  }

  postFileUpload(fileArgs: { file: File | Blob }): Promise<UploadFileResponse> {
    return this._postMultipart<UploadFileResponse>("/uploads/file", fileArgs);
  }

  postDatasetUpload(datasetParams: DatasetParams): Promise<any> {
    return this._fetchWithJsonBody("/dataset-v2/", "POST", datasetParams);
  }

  postDataset(datasetArgs: any, allowed_values: string[]): Promise<Dataset> {
    const data = new FormData();
    const jsonFormParams = ["dataset_metadata"];

    const datasetArgsCopy = { ...datasetArgs };

    // eslint-disable-next-line no-restricted-syntax
    for (const prop of Object.keys(datasetArgsCopy)) {
      if (jsonFormParams.includes(prop) && prop in datasetArgsCopy) {
        datasetArgsCopy[prop] = JSON.stringify(datasetArgsCopy[prop]);
      }
      if (Object.prototype.hasOwnProperty.call(datasetArgsCopy, prop)) {
        data.append(prop, datasetArgsCopy[prop]);
      }
    }
    const params: any = {
      allowed_values,
    };
    const url = `/datasets/?${encodeParams(params)}`;
    const fullUrl = this.urlPrefix + url;
    log(`fetching ${fullUrl}`);

    return fetch(fullUrl, {
      credentials: "include",
      method: "POST",
      body: data,
    }).then(
      (response: Response): Promise<Dataset> => {
        return response.json().then(
          (body: UploadTask): Promise<Dataset> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body.result?.dataset);
            }
            // eslint-disable-next-line prefer-promise-reject-errors
            return Promise.reject({ body, status: response.status } as {
              body: UploadTask;
              status: number;
            });
          }
        );
      }
    );
  }

  getTabularDatasetData(
    datasetId: string,
    args: {
      identifier: "id" | "label";
      columns?: string[] | null;
    }
  ): Promise<{ [key: string]: { [key: string]: any } }> {
    const url = `/datasets/tabular/${datasetId}`;
    return this._fetchWithJsonBody(url, "POST", args);
  }

  getDimensionTypes(): Promise<DimensionType[]> {
    return this._fetch<DimensionType[]>("/types/dimensions");
  }

  getDimensionType(name: string): Promise<DimensionType> {
    return this._fetch<DimensionType>(`/types/dimensions/${name}`);
  }

  postDimensionType(dimTypeArgs: DimensionTypeAddArgs): Promise<DimensionType> {
    console.log("In bbapi.ts: ", dimTypeArgs);

    return this._fetchWithJsonBody<DimensionType>(
      "/types/dimensions",
      "POST",
      dimTypeArgs
    );
  }

  updateDimensionType(
    dimTypeName: string,
    dimTypeArgs: DimensionTypeUpdateArgs
  ): Promise<DimensionType> {
    const url = `/types/dimensions/${dimTypeName}`;

    return this._fetchWithJsonBody(url, "PATCH", dimTypeArgs);
  }

  deleteDimensionType(name: string) {
    return this._delete("/types/dimensions", name);
  }

  searchDimensions({
    prefix,
    substring,
    type_name,
    limit,
  }: SearchDimenionsRequest) {
    const params = {
      prefix,
      substring,
      type_name,
      limit: Number.isFinite(limit) ? limit : 100,
    };

    return this._fetch<SearchDimenionsResponse>(
      `/datasets/dimensions/?${encodeParams(params)}`
    );
  }

  async getDataTypesAndPriorities(): Promise<InvalidPrioritiesByDataType> {
    const dataTypesPriorities = await this._fetch<InvalidPrioritiesByDataType>(
      "/data_types/priorities"
    );

    return dataTypesPriorities;
  }

  getGroups(writeAccess: boolean = false): Promise<Group[]> {
    const queryParams = { write_access: writeAccess };
    return this._fetch<Group[]>(`/groups/?${encodeParams(queryParams)}`);
  }

  postGroup(groupArgs: GroupArgs): Promise<Group> {
    return this._fetchWithJsonBody<Group>("/groups/", "POST", groupArgs);
  }

  deleteGroup(id: string) {
    return this._delete("/groups", id);
  }

  postGroupEntry(
    groupId: string,
    groupEntryArgs: GroupEntryArgs
  ): Promise<GroupEntry> {
    return this._fetchWithJsonBody<GroupEntry>(
      `/groups/${groupId}/addAccess`,
      "POST",
      groupEntryArgs
    );
  }

  deleteGroupEntry(groupEntryId: string) {
    const url = `/groups/${groupEntryId}/removeAccess`;
    const fullUrl = this.urlPrefix + url;
    return fetch(fullUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: groupEntryId,
    }).then(
      (response: Response): Promise<string> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: string): Promise<string> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  }

  postCustomCsv = (config: AddDatasetOneRowArgs): Promise<UploadTask> => {
    const { uploadFile } = config;
    const { name } = uploadFile;
    const finalConfig: AddCustDatasetArgs = {
      name,
      units: "float",
      feature_type: "generic",
      sample_type: "depmap_model",
      value_type: DatasetValueType.continuous,
      data_file: config.uploadFile,
      is_transient: true,
    };
    return this._postMultipart<UploadTask>("/datasets/", finalConfig);
  };

  _assertCsvSingleColumnNoHeader = (
    dataRow: any[],
    index: number
  ): UploadTaskUserError | null => {
    if (dataRow.length > 2) {
      return {
        message: "File has too many columns",
      };
    }

    if (index === 0) {
      if (
        dataRow[0] === undefined ||
        dataRow[0] === null ||
        dataRow[0] === ""
      ) {
        return {
          message:
            "Index of first row is NaN. Please upload a file without a header.",
        };
      }
    }

    return null;
  };

  parseFileToAddHeader = (rawFile: any, headerStr: string) => {
    return new Promise<any>((resolve, reject) => {
      Papa.parse(rawFile, {
        complete: (results) => {
          results.data.map((val, index) => {
            const error = this._assertCsvSingleColumnNoHeader(val, index);
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

  async postCustomCsvOneRow(config: AddDatasetOneRowArgs): Promise<UploadTask> {
    const { uploadFile } = config;
    const { name } = uploadFile;

    return this.parseFileToAddHeader(config.uploadFile, "custom data")
      .then((parsedFile) => {
        const unparsedFile = Papa.unparse(parsedFile);
        const finalUploadFile = new Blob([unparsedFile], {
          type: "text/csv",
        });

        const finalConfig: AddCustDatasetArgs = {
          name,
          units: "float",
          feature_type: "generic",
          sample_type: "depmap_model",
          value_type: DatasetValueType.continuous,
          data_file: finalUploadFile,
          is_transient: true,
        };

        return this._postMultipart<UploadTask>("/datasets/", finalConfig);
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

  getTaskStatus(id: string): Promise<CeleryTask> {
    return this._fetch<CeleryTask>(`/api/task/${id}`);
  }

  getCellLineSelectorLines(): Promise<CellLineSelectorLines> {
    return this._fetch<CellLineSelectorLines>(
      "/partials/data_table/cell_line_selector_lines"
    );
  }

  getCellignerColorMap(): Promise<CellignerColorsForCellLineSelector> {
    return Promise.reject(Error("getCellignerColorMap() not implemented"));
  }

  computeUnivariateAssociations(
    config: UnivariateAssociationsParams
  ): Promise<ComputeResponse> {
    return this._fetchWithJsonBody<ComputeResponse>(
      "/compute/compute_univariate_associations",
      "POST",
      config
    );
  }

  fetchAssociations(sliceQuery: SliceQueryAssociations) {
    return this._fetchWithJsonBody<DatasetAssociations>(
      "/temp/associations/query-slice",
      "POST",
      sliceQuery
    );
  }

  _fetchWithJsonBody = <T>(
    url: string,
    method: string,
    body_content: any
  ): Promise<T> => {
    const fullUrl = this.urlPrefix + url;
    log(`${method} json to ${fullUrl}`);

    const headers: { [key: string]: string } = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const traceParentField = this.getTraceParentField();
    if (traceParentField) {
      // eslint-disable-next-line @typescript-eslint/dot-notation
      headers["traceparent"] = traceParentField;
    }
    return fetch(fullUrl, {
      credentials: "include",
      method,
      headers,
      body: JSON.stringify(body_content),
    }).then(
      (response: Response): Promise<T> => {
        log(`response arrived from ${fullUrl}`);
        return response.json().then(
          (body: T): Promise<T> => {
            // nesting to access response.status
            if (response.status >= 200 && response.status < 300) {
              return Promise.resolve(body);
            }
            return Promise.reject(body);
          }
        );
      }
    );
  };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  // NOTE: These endpoints for feature type and sample type should not be used because they are deprecated
  getSampleTypes() {
    return Promise.reject(Error("Deprecated function! Use getDimensionTypes."));
  }

  postSampleType(sampleTypeArgs: any) {
    return Promise.reject(Error("Deprecated function! Use postDimensionType."));
  }

  updateSampleType(sampleTypeArgs: any) {
    return Promise.reject(
      Error("Deprecated function! Use updateDimensionType.")
    );
  }

  deleteSampleType(name: string) {
    return Promise.reject(
      Error("Deprecated function! Use deleteDimensionType.")
    );
  }

  getFeatureTypes() {
    return Promise.reject(Error("Deprecated function! Use getDimensionTypes."));
  }

  postFeatureType(featureTypeArgs: any) {
    return Promise.reject(Error("Deprecated function! Use postDimensionType."));
  }

  updateFeatureType(featureTypeArgs: any) {
    return Promise.reject(
      Error("Deprecated function! Use updateDimensionType.")
    );
  }

  deleteFeatureType(name: string) {
    return Promise.reject(
      Error("Deprecated function! Use deleteDimensionType.")
    );
  }

  // NOTE: THe above endpoints for feature type and sample type are deprecated and should not be used.
  // Endpoints with URI prefix /types/dimensions should be used instead
}
