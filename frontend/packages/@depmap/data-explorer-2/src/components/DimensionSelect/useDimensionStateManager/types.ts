import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfigDimension,
} from "@depmap/types";
import type { DeprecatedDataExplorerApiResponse } from "../../../services/deprecatedDataExplorerAPI";

export type Mode = "entity-only" | "context-only" | "entity-or-context";
export type PartialDimension = Partial<DataExplorerPlotConfigDimension>;
export type DimensionLabelsToDatasetsMapping = DeprecatedDataExplorerApiResponse["fetchDimensionLabelsToDatasetsMapping"];

type Option = {
  label: string;
  value: string;
  isDisabled: boolean;
  disabledReason: string;
};

export type DatasetsByIndexType = Record<
  string,
  DataExplorerDatasetDescriptor[]
>;

export interface State {
  dirty: boolean;
  justSynced: boolean;
  unitsOptions: Option[];
  dataTypeOptions: Option[];
  sliceTypeOptions: Option[];
  dataVersionOptions: (Option & { isDefault: boolean })[];
  dataType: string | null;
  units: string | null;
  dimension: PartialDimension;
}

export const DEFAULT_STATE: State = {
  dirty: false,
  justSynced: false,
  unitsOptions: [],
  dataTypeOptions: [],
  sliceTypeOptions: [],
  dataVersionOptions: [],
  dataType: null,
  units: null,
  dimension: {},
};

export type Changes = Partial<{
  aggregation: string;
  index_type: string | null;
  dataType: string | null;
  units: string | null;
  slice_type: string | null;
  dataset_id: string | null;
  axis_type: "raw_slice" | "aggregated_slice" | null;
  context: DataExplorerContext | null;
}>;

export type Update = (changes: Changes) => void;
