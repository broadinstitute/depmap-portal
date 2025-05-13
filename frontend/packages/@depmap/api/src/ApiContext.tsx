import React from "react";
import { UserUploadArgs, UploadTask } from "@depmap/user-upload";
import {
  CellLineSelectorLines,
  CellignerColorsForCellLineSelector,
} from "@depmap/cell-line-selector";
import {
  CeleryTask,
  Dataset,
  ComputeResponse,
  UnivariateAssociationsParams,
} from "@depmap/compute";
import {
  AddDatasetOneRowArgs,
  AssociationAndCheckbox,
  Dataset as BreadboxDataset,
  DatasetParams,
  DatasetUpdateArgs,
  FeatureType,
  InvalidPrioritiesByDataType,
  FeatureTypeUpdateArgs,
  Group,
  GroupArgs,
  GroupEntry,
  GroupEntryArgs,
  SampleType,
  SampleTypeUpdateArgs,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
  UploadFileResponse,
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
  SliceQuery,
} from "@depmap/types";
import {
  DatasetDownloadMetadata,
  ExportDataQuery,
  ExportMergedDataQuery,
  FeatureValidationQuery,
  ValidationResult,
} from "@depmap/data-slicer";

export interface SharedApi {
  urlPrefix: string;
  getDatasets: () => Promise<Dataset[]>;
  getFeedbackUrl: () => Promise<string>;
  exportData: (query: ExportDataQuery) => Promise<any>;
  exportDataForMerge: (query: ExportMergedDataQuery) => Promise<any>;
  validateFeaturesInDataset(
    query: FeatureValidationQuery
  ): Promise<ValidationResult>;
  getDatasetsList(): Promise<DatasetDownloadMetadata[]>;
  getCellLineUrlRoot: () => Promise<string>;
  getTaskStatus: (id: string) => Promise<CeleryTask>;
  getCellLineSelectorLines: () => Promise<CellLineSelectorLines>;
  getAssociations: (x: string) => Promise<AssociationAndCheckbox>;
  postCustomTaiga: (config: UserUploadArgs) => Promise<UploadTask>;
  postCustomCsv: (config: UserUploadArgs) => Promise<UploadTask>;
  getCellignerColorMap: () => Promise<CellignerColorsForCellLineSelector>;
  searchDimensions: (
    req: SearchDimenionsRequest
  ) => Promise<SearchDimenionsResponse>;

  // The following will throw errors if used in depmap mode. They're only relevant to breadbox.
  getBreadboxDatasets: () => Promise<BreadboxDataset[]>;
  getBreadboxUser: () => Promise<string>;
  postFileUpload: (fileArgs: {
    file: File | Blob;
  }) => Promise<UploadFileResponse>;
  postDatasetUpload: (datasetParams: DatasetParams) => Promise<any>;
  postDataset: (
    datasetArgs: any,
    allowed_values: string[]
  ) => Promise<BreadboxDataset>;
  deleteDatasets: (id: string) => Promise<any>;
  updateDataset: (
    datasetId: string,
    datasetToUpdate: DatasetUpdateArgs
  ) => Promise<BreadboxDataset>;
  getDatasetFeatures: (
    datasetId: string
  ) => Promise<{ id: string; label: string }[]>;
  getTabularDatasetData: (
    datasetId: string,
    args: {
      identifier: "id" | "label";
      columns?: string[] | null;
    }
  ) => Promise<{ [key: string]: { [key: string]: any } }>;
  getGroups: (writeAccess?: boolean) => Promise<Group[]>;
  postGroup: (groupArgs: GroupArgs) => Promise<Group>;
  deleteGroup: (id: string) => Promise<any>;
  postGroupEntry: (
    groupId: string,
    groupEntryArgs: GroupEntryArgs
  ) => Promise<GroupEntry>;
  deleteGroupEntry: (groupEntryId: string) => Promise<any>;
  getDataTypesAndPriorities: () => Promise<InvalidPrioritiesByDataType>;
  // NOTE: The endpoints for feature type and sample type are deprecated and should not be used.
  getFeatureTypes: () => Promise<FeatureType[]>;
  getSampleTypes: () => Promise<SampleType[]>;
  postSampleType: (sampleTypeArgs: any) => Promise<SampleType>;
  postFeatureType: (featureTypeArgs: any) => Promise<FeatureType>;
  deleteSampleType: (name: string) => Promise<any>;
  deleteFeatureType: (name: string) => Promise<any>;
  updateSampleType: (
    sampleTypeArgs: SampleTypeUpdateArgs
  ) => Promise<SampleType>;
  updateFeatureType: (
    featureTypeArgs: FeatureTypeUpdateArgs
  ) => Promise<FeatureType>;
  // NOTE: The endpoints for dimension type should be used instead of ones for feature and sample type
  getDimensionTypes: () => Promise<DimensionType[]>;
  getDimensionType: (name: string) => Promise<DimensionType>;
  postDimensionType: (
    dimTypeArgs: DimensionTypeAddArgs
  ) => Promise<DimensionType>;
  updateDimensionType: (
    dimTypeName: string,
    dimTypeArgs: DimensionTypeUpdateArgs
  ) => Promise<DimensionType>;
  deleteDimensionType: (name: string) => Promise<any>;
  getMetadata: (label: string) => Promise<any>;
  computeUnivariateAssociations: (
    config: UnivariateAssociationsParams
  ) => Promise<ComputeResponse>;
  fetchAssociations: (
    sliceQuery: SliceQuery
  ) => Promise<{
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
  }>;
  postCustomCsvOneRow: (config: AddDatasetOneRowArgs) => Promise<UploadTask>;
}

export interface ApiContextInterface {
  getApi: () => SharedApi;
}

const apiFunctions = {
  breadbox: {
    getApi: () => {
      throw new Error("getBreadboxApi is not implemented");
    },
  },
  depmap: {
    getApi: () => {
      throw new Error("getDapi is not implemented");
    },
  },
};

const ApiContext = React.createContext<ApiContextInterface>(
  apiFunctions.depmap
);

export default ApiContext;
