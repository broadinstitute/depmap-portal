import {
  DataExplorerContext,
  DataExplorerDatasetDescriptor,
  DataExplorerPlotConfigDimension,
} from "@depmap/types";
import { fetchEntityToDatasetsMapping } from "../../../api";

export type Mode = "entity-only" | "context-only" | "entity-or-context";
export type PartialDimension = Partial<DataExplorerPlotConfigDimension>;
export type EntityToDatasetsMapping = Awaited<
  ReturnType<typeof fetchEntityToDatasetsMapping>
>;

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
  entityTypeOptions: Option[];
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
  entityTypeOptions: [],
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
  entity_type: string | null;
  dataset_id: string | null;
  axis_type: "context" | "entity" | null;
  context: DataExplorerContext | null;
}>;

export type Update = (changes: Changes) => void;
