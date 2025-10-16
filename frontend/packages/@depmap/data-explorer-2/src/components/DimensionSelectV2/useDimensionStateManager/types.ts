import type { ReactNode } from "react";
import type {
  DataExplorerContextV2,
  DataExplorerPlotConfigDimensionV2,
} from "@depmap/types";

export type Mode = "entity-only" | "context-only" | "entity-or-context";
export type PartialDimension = Partial<DataExplorerPlotConfigDimensionV2>;

export interface SliceTypeNull {
  valueOf(): null;
  toJSON(): null;
  toString(): string;
}

// Sentinel value used in place of `null` to make it clear that is valid for a
// DataExplorerPlotConfigDimensionV2 to have its `slice_type` set to `null` (so
// long as the dataset_id matches a featureless dataset).
export const SLICE_TYPE_NULL: SliceTypeNull = Object.freeze({
  valueOf() {
    return null;
  },
  toJSON() {
    return null;
  },
  toString() {
    return "(dataset specific)";
  },
});

type BaseOption = {
  label: string;
  isDisabled: boolean;
  disabledReason: ReactNode;
};

type UnitsOption = BaseOption & { value: string };
type DataTypeOption = BaseOption & { value: string };
type SliceTypeOption = BaseOption & { value: string | SliceTypeNull };
type DataVersionOption = BaseOption & {
  value: string;
  isDefault: boolean;
};

export interface State {
  dirty: boolean;
  needsSync: boolean;
  unitsOptions: UnitsOption[];
  dataTypeOptions: DataTypeOption[];
  sliceTypeOptions: SliceTypeOption[];
  dataVersionOptions: DataVersionOption[];
  dataType: string | null;
  units: string | null;
  isUnknownDataset: boolean;
  dimension: PartialDimension;
  allowNullFeatureType: boolean;
  valueTypes: Set<"continuous" | "text" | "categorical" | "list_strings">;
}

export const DEFAULT_STATE: State = {
  dirty: false,
  needsSync: false,
  unitsOptions: [],
  dataTypeOptions: [],
  sliceTypeOptions: [],
  dataVersionOptions: [],
  dataType: null,
  units: null,
  isUnknownDataset: false,
  dimension: {},
  allowNullFeatureType: false,
  valueTypes: new Set(),
};

export type Changes = Partial<{
  aggregation: string;
  index_type: string | null;
  dataType: string | null;
  units: string | null;
  slice_type: string | SliceTypeNull;
  dataset_id: string | null;
  axis_type: "raw_slice" | "aggregated_slice" | null;
  context: DataExplorerContextV2 | null;
  isUnknownDataset: boolean;
}>;

export type Update = (changes: Changes) => void;
