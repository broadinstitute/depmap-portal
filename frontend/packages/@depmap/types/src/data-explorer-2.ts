import { SliceQuery } from "./SliceQuery";

type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> };

export type DataExplorerPlotType =
  | "density_1d"
  | "scatter"
  | "correlation_heatmap"
  | "waterfall";

export type DataExplorerContextVariable = SliceQuery & {
  source?: "metadata_column" | "annotation" | "matrix";
  value_type?: "categorical" | "continuous" | "list_strings";
  slice_type?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataExplorerContextExpression = Record<string, any> | boolean;

export type DataExplorerContext = {
  name: string;
  context_type: string;
  expr: DataExplorerContextExpression;
};

export type DataExplorerContextV2 = {
  name: string;
  dimension_type: string;
  expr: DataExplorerContextExpression;
  vars: Record<string, DataExplorerContextVariable>;
};

export type DataExplorerAnonymousContext = Omit<DataExplorerContext, "name">;

export type DataExplorerAggregation =
  | "first"
  | "correlation"
  | "mean"
  | "median"
  | "25%tile"
  | "75%tile";

export type DimensionKey = "x" | "y" | "color";
export type FilterKey =
  | "color1"
  | "color2"
  | "visible"
  | "distinguish1"
  | "distinguish2";

export type DataExplorerFilters = Partial<
  Record<FilterKey, DataExplorerContext>
>;

export interface DataExplorerPlotConfigDimension {
  axis_type: "raw_slice" | "aggregated_slice";
  slice_type: string;
  dataset_id: string;
  context: DataExplorerContext;
  aggregation: DataExplorerAggregation;
}

// TODO: Rework this to work SliceQuery objects instead of Slice IDs.
export type DataExplorerMetadata = Record<string, { slice_id: string }>;

export interface DataExplorerPlotResponseDimension {
  axis_label: string;
  dataset_id: string;
  dataset_label: string;
  slice_type: string;
  values: number[];
}

export type colorByValue =
  | "raw_slice"
  | "aggregated_slice"
  | "property"
  | "custom";

// A DataExplorerPlotConfig is an object with all the configurable parameters
// used to generate a plot. Note that some properties only make sense with
// certain plot types (but encoding that in type system would be much more
// trouble than it's worth).
export interface DataExplorerPlotConfig {
  plot_type: DataExplorerPlotType;
  index_type: string;
  dimensions: Partial<Record<DimensionKey, DataExplorerPlotConfigDimension>>;
  color_by?: colorByValue;
  filters?: DataExplorerFilters;
  metadata?: DataExplorerMetadata;

  // unique to density_1d (and waterfall in future)
  // TODO: Add "median"
  sort_by?:
    | "mean_values_asc"
    | "mean_values_desc"
    | "max_values"
    | "min_values"
    | "num_points"
    | "alphabetical";

  // unique to density_1d
  hide_points?: boolean;

  // unique to scatter
  hide_identity_line?: boolean;
  show_regression_line?: boolean;

  // unique to correlation_heatmap
  use_clustering?: boolean;
}

export type PartialDataExplorerPlotConfig = PartialDeep<DataExplorerPlotConfig>;

interface IndexAlias {
  label: string;
  slice_id: string;
  values: string[];
}

export interface DataExplorerPlotResponse {
  index_type: string;
  index_labels: string[];
  index_aliases: IndexAlias[];
  dimensions: {
    x: DataExplorerPlotResponseDimension;
    y?: DataExplorerPlotResponseDimension;
    color?: DataExplorerPlotResponseDimension;
    // "x2" is a pseudo-dimension returned by the /get_correlation endpoint
    x2?: DataExplorerPlotResponseDimension;
  };
  filters: Partial<Record<FilterKey, { name: string; values: boolean[] }>>;
  metadata: Partial<
    Record<
      string,
      {
        label: string;
        slice_id: string;
        values: (string | number)[];
      }
    >
  >;
}

// Contexts are used in two different ways:
// - As a property of each dimension
// - As filters
// When configuring them, it's convenient to be able to specify their path
// within a `DataExplorerPlotConfig` object.
export type ContextPath =
  | ["dimensions", "x", "context"]
  | ["dimensions", "y", "context"]
  | ["dimensions", "color", "context"]
  | ["filters", "color1"]
  | ["filters", "color2"]
  | ["filters", "visible"]
  | ["filters", "distinguish1"]
  | ["filters", "distinguish2"];

export interface DataExplorerDatasetDescriptor {
  data_type: string;
  dataset_id: string;
  index_type: string;
  slice_type: string;
  label: string;
  units: string;
  priority: number;
}

type ContextWithoutExprOrVars = {
  name: string;
  context_type: string;
  // HACK: This property is never saved in local storage. It's just a temporary
  // tag that loadContextsFromLocalStorage() creates.
  isLegacyList?: boolean;
};
export type StoredContexts = Record<string, ContextWithoutExprOrVars>;
