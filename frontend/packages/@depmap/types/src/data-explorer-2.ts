type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> };

export type DataExplorerPlotType =
  | "density_1d"
  | "scatter"
  | "correlation_heatmap"
  | "waterfall";

export type DataExplorerContext = {
  name: string;
  context_type: string;
  // TODO: Add a ContextExpression type. It should be based on JSON logic but
  // not necessarily tied to that library.
  expr: Record<string, any> | boolean;
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
  axis_type: "entity" | "context";
  entity_type: string;
  dataset_id: string;
  context: DataExplorerContext;
  aggregation: DataExplorerAggregation;
}

// HACK: This Metadata type is intended as a stopgap. It should be removed from
// the data model when we migrate to BreadBox. Its purpose is to provide a way
// to request series that can *only* be referenced by `slice_id`. Certain
// pseudo-datasets (e.g. lineage) don't have a `dataset_id` or `entity_type`
// and thus are incompatible with the above notion of a dimension. Such
// datasets cannot be plotted directly but it's still useful to get data from
// them for the purposes of coloring and filtering.
export type DataExplorerMetadata = Record<string, { slice_id: string }>;

export interface DataExplorerPlotResponseDimension {
  axis_label: string;
  dataset_id: string;
  dataset_label: string;
  entity_type: string;
  values: number[];
}

// A DataExplorerPlotConfig is an object with all the configurable parameters
// used to generate a plot. Note that some properties only make sense with
// certain plot types (but encoding that in type system would be much more
// trouble than it's worth).
export interface DataExplorerPlotConfig {
  plot_type: DataExplorerPlotType;
  index_type: string;
  dimensions: Partial<Record<DimensionKey, DataExplorerPlotConfigDimension>>;
  color_by?: "entity" | "context" | "property" | "custom";
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
  // "x2" is a pseudo-dimension returned by the /get_correlation endpoint
  dimensions: Record<DimensionKey | "x2", DataExplorerPlotResponseDimension>;
  filters: Partial<Record<FilterKey, { name: string; values: boolean[] }>>;
  metadata: Partial<
    Record<string, { slice_id: string; values: (string | number)[] }>
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
  entity_type: string;
  label: string;
  units: string;
  priority: number;
}

type ContextWithoutExpr = {
  name: string;
  context_type: string;
  // HACK: This property is never saved in local storage. It's just a temporary
  // tag that loadContextsFromLocalStorage() creates.
  isLegacyList?: boolean;
};
export type StoredContexts = Record<string, ContextWithoutExpr>;
