import { TagOption } from "@depmap/common-components";

export interface DimensionMetadata {
  // Sample (e.g. ACH-00008) or feature (e.g. SOX10) label
  label: string;
  metadata: any;
}

export interface DimensionMetadataTableData {
  metadataName: string;
  metadataValue: string;
}

export enum AnnotationType {
  continuous = "continuous",
  categorical = "categorical",
  binary = "binary",
  text = "text",
  listStrings = "list_strings",
}
export interface AnnotationTypeMap {
  annotation_type_mapping: { [key: string]: AnnotationType };
}

export interface AnnotationTypingInput {
  readonly options: TagOption[];
  readonly remainingOptions: TagOption[];
  selectedContinuousAnnotations: TagOption[] | null;
  selectedCategoricalAnnotations: TagOption[] | null;
  selectedBinaryAnnotations: TagOption[] | null;
  selectedTextAnnotations: TagOption[] | null;
  selectedStringListAnnotations: TagOption[] | null;
}

interface SearchDimensionCommon {
  limit: number;
  type_name?: string;
}

interface SearchDimensionPrefix extends SearchDimensionCommon {
  prefix: string;
  substring?: never;
}

interface SearchDimensionSubstring extends SearchDimensionCommon {
  substring: string;
  prefix?: never;
}

export type SearchDimenionsRequest =
  | SearchDimensionPrefix
  | SearchDimensionSubstring;

export type SearchDimenionsResponse = {
  type_name: string;
  id: string;
  label: string;
  matching_properties: {
    property: string;
    value: string;
  }[];
}[];

export interface ColumnMetadata {
  units: string;
  col_type: AnnotationType;
  references: string[];
}
