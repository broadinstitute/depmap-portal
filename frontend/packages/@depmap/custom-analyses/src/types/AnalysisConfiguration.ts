import { DataExplorerContextV2, SliceQuery } from "@depmap/types";

export interface PearsonCorrelationConfiguration {
  kind: "pearson_correlation";
  index_type: string; // @default "depmap_model"
  dataSource: "portal_data" | "custom"; // @default "portal_data"
  datasetId: string;
  customDatasetFilename?: string;
  sliceSource: "portal_data" | "custom"; // @default "portal_data"
  sliceQuery: SliceQuery;
  customSliceFilename?: string;
  unfiltered: boolean; // @default true
  filterByContext?: DataExplorerContextV2;
}

export interface TwoClassComparisonConfiguration {
  kind: "two_class_comparison";
  index_type: string; // @default "depmap_model"
  dataSource: "portal_data" | "custom"; // @default "portal_data"
  datasetId: string;
  customDatasetFilename?: string;
  inGroupContext: DataExplorerContextV2;
  useAllOthers: boolean; // @default true
  outGroupContext?: DataExplorerContextV2;
}

export type AnalysisConfiguration =
  | PearsonCorrelationConfiguration
  | TwoClassComparisonConfiguration;

type PartialExcept<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>;

export type PartialPearsonCorrelationConfiguration = PartialExcept<
  PearsonCorrelationConfiguration,
  // These all have defaults set by the reducer, so even a
  // partial PearsonCorrelationConfiguration will have them.
  "kind" | "index_type" | "dataSource" | "sliceSource" | "unfiltered"
>;

export type PartialTwoClassComparisonConfiguration = PartialExcept<
  TwoClassComparisonConfiguration,
  // These all have defaults set by the reducer, so even a
  // partial TwoClassComparisonConfiguration will have them.
  "kind" | "index_type" | "dataSource" | "useAllOthers"
>;
