// These are all classes or enums (which can act as types but aren't simply types)
export { AccessType } from "./src/Group";
export { AnnotationType } from "./src/Metadata";
export { DatasetValueType } from "./src/Dataset";
export { FeatureTypeUpdateArgs } from "./src/FeatureType";
export { SampleTypeUpdateArgs } from "./src/SampleType";

// type predicate
export { instanceOfErrorDetail } from "./src/ErrorDetail";

export type { LinRegInfo } from "./src/interactive";
export type { default as FeatureType } from "./src/FeatureType";
export type { default as SampleType } from "./src/SampleType";
export type {
  default as DataType,
  InvalidPrioritiesByDataType,
} from "./src/DataType";

export type {
  DimensionType,
  DimensionTypeAddArgs,
  DimensionTypeUpdateArgs,
} from "./src/DimensionType";

export type {
  Dataset,
  AddCustDatasetArgs,
  DatasetParams,
  DatasetTableData,
  DatasetUpdateArgs,
} from "./src/Dataset";

export type {
  AnnotationTypingInput,
  DimensionMetadata,
  DimensionMetadataTableData,
  SearchDimenionsRequest,
  SearchDimenionsResponse,
} from "./src/Metadata";

export type {
  default as Group,
  GroupTableData,
  GroupArgs,
  GroupEntry,
  GroupEntryArgs,
} from "./src/Group";

export type * from "./src/data-explorer-2";
export type { UploadFileResponse } from "./src/UploadFileResponse";
