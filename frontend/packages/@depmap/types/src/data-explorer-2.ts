import { SliceQuery } from "./SliceQuery";

type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> };

export type DataExplorerPlotType =
  | "density_1d"
  | "scatter"
  | "correlation_heatmap"
  | "waterfall";

export type DataExplorerContextVariable = SliceQuery & {
  source?: "property" | "custom";
  slice_type?: string | null;
  label?: string;
};

export type ColorByValue =
  | "raw_slice"
  | "aggregated_slice"
  | "property"
  | "custom"
  | "expansion";

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
  contexts?: Record<string, DataExplorerContextV2>;
};

export type DataExplorerAnonymousContext = Omit<DataExplorerContext, "name">;

// Despite its name, `aggregation` is really a resolution-mode discriminator:
// how an axis turns a slice_type into per-index values. Most members are true
// statistical aggregations, but "first" (take-first selection) and
// "correlation" (a correlation_heatmap mode) are not, and "expansion" (below)
// is the third non-aggregation. The Breadbox boundary rejects all three
// non-aggregations explicitly. A future rename to something more general
// (e.g. `processor`/`mapping`), with translation for old saved plots, is
// possible; until then this is the deliberate, documented home for all of them.
export type DataExplorerAggregation =
  | "first"
  | "correlation"
  | "mean"
  | "median"
  | "25%tile"
  | "75%tile"
  | "stddev"
  // Sentinel — NOT a real aggregation; if anything, the opposite. It marks an
  // axis whose per-pair values come from an expansion (fetchExpandedPlot), not
  // from aggregating a slice. It rides on the required `aggregation` field to
  // preserve that field's always-present invariant without restructuring the
  // dimension type. Identity check: `dim.aggregation === "expansion"` (see
  // isExpansionDimension). It must NEVER reach Breadbox: the materializer
  // guards and the getMatrixDatasetData trap enforce that.
  | "expansion";

export type DimensionKey = "x" | "y" | "color";
export type FilterKey =
  | "color1"
  | "color2"
  | "visible"
  | "distinguish1"
  | "distinguish2";

export type DataExplorerFilters = Partial<
  Record<FilterKey, DataExplorerContext | DataExplorerContextV2>
>;

export interface DataExplorerPlotConfigDimension {
  axis_type: "raw_slice" | "aggregated_slice";
  slice_type: string;
  dataset_id: string;
  context: DataExplorerContext | DataExplorerContextV2;
  aggregation: DataExplorerAggregation;
}

export type PartialDataExplorerPlotConfigDimension = PartialDeep<DataExplorerPlotConfigDimension>;

export interface DataExplorerPlotConfigDimensionV2
  extends Omit<DataExplorerPlotConfigDimension, "slice_type" | "context"> {
  slice_type: string | null;
  context: DataExplorerContextV2;
}

export type PartialDataExplorerPlotConfigDimensionV2 = PartialDeep<DataExplorerPlotConfigDimensionV2>;

export type DataExplorerMetadata = Record<
  string,
  { slice_id: string } | SliceQuery
>;

export interface DataExplorerPlotResponseDimension {
  axis_label: string;
  dataset_id: string;
  dataset_label: string;
  slice_type: string;
  values: number[];
  value_type: "continuous" | "text" | "categorical" | "list_strings";
}

// A single expansion: fans each index entity out into one point per member of
// `context` (e.g. depmap_model × transcript). `expand_by` is a plot-level
// concept (not a per-axis flag) by design. The count is currently capped at
// one by the materializer; the type is an array to leave room for
// multi-expansion, which is deferred (see fetchExpandedPlot's header). `limit`
// bounds the fan-out for browser safety and keeps the plot self-describing;
// the UI seeds a default and a separate hard ceiling is enforced at the
// materializer. The axis that *reads* each per-pair value is the one carrying
// the "expansion" sentinel on `aggregation`.
export interface DataExplorerExpandBy {
  slice_type: string;
  context: DataExplorerContextV2;
  limit: number;
  // Pagination window start, in context order (0-based; defaults to 0). With
  // `limit` as the page size, the fetcher materializes members
  // [offset, offset + min(limit, MAX_EXPANSION_MEMBERS)). Interim: this is a
  // contiguous-range stopgap that will be retired once the user can select an
  // explicit member subset (at which point `context` becomes that subset and
  // `offset` goes away).
  offset?: number;
}

export interface DataExplorerExpandedPlotConfig {
  index_type: string;
  dimensions: Record<string, DataExplorerPlotConfigDimension>;
  expand_by: DataExplorerExpandBy[]; // length 0 or 1 today (one expansion)
  filters?: DataExplorerFilters;
  metadata?: DataExplorerMetadata;
}

export interface DataExplorerExpansion {
  // Identity. The "points-index" — i.e. the per-cell entity id for this
  // expansion axis. Parallel to the response's index_ids.
  ids: string[];

  // Human-readable display labels, parallel to `ids`.
  labels: string[];

  // The dimension type's id column name from Breadbox
  // (e.g. "ensembl_transcript_id"). Mirrors `index_id_column` at the
  // expansion level. Used to make bare ids legible in hover text.
  id_column?: string;

  // The dimension type's human-readable display name from Breadbox
  // (e.g. "Transcript", "Gene"). Mirrors `index_display_name` at the
  // expansion level. Preferred over `slice_type` as a prefix in
  // display contexts because slice_type is a machine-readable name
  // ("transcript") while display_name is the curated label
  // ("Transcript").
  display_name?: string;

  // The slice_type this expansion is over (e.g. "transcript").
  slice_type: string;

  // Number of distinct expansion members the context yielded *before* the
  // limit/ceiling was applied. `ids`/`labels` reflect the (possibly truncated)
  // shown set, so the UI can surface "showing K of total_available".
  total_available?: number;

  // True when members were dropped to satisfy the cap (i.e. total_available
  // exceeded min(expand_by.limit, MAX_EXPANSION_MEMBERS)). Truncation is
  // currently arbitrary (first-N in context order); a "most interesting
  // members" selection is a planned follow-up.
  truncated?: boolean;
}

export interface DataExplorerExpandedPlotResponse
  extends DataExplorerPlotResponse {
  // Parallel to index_ids/index_labels. Length 0 or 1 today (one expansion).
  // Each entry's `ids`/`labels` arrays have the same N×M length as
  // index_ids/index_labels.
  expansions: DataExplorerExpansion[];
}

// A DataExplorerPlotConfig is an object with all the configurable parameters
// used to generate a plot. Note that some properties only make sense with
// certain plot types (but encoding that in type system would be much more
// trouble than it's worth).
export interface DataExplorerPlotConfig {
  plot_type: DataExplorerPlotType;
  index_type: string;
  dimensions: Partial<Record<DimensionKey, DataExplorerPlotConfigDimension>>;

  // At most one expansion (see DataExplorerExpandBy). When present, the plot's
  // point set fans from N index entities to N×M (entity, expansion-member)
  // pairs. Absent or empty means an ordinary single-axis plot.
  expand_by?: DataExplorerExpandBy[];
  color_by?: ColorByValue;

  // `group_by` controls which per-point categorical drives spatial
  // grouping (violin tracks in density_1d, x-position clustering in
  // waterfall) — separately from `color_by`, which drives point colors.
  // When unset, falls back to `color_by`, so existing configs preserve
  // the historical conflation. Set explicitly when you want grouping
  // and coloring to use different sources (e.g. group by lineage,
  // color by transcript). Renderers that don't yet honor `group_by`
  // simply ignore it.
  group_by?: ColorByValue;

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

export interface DataExplorerPlotResponse {
  index_type: string;

  // The id column name for `index_type` as reported by Breadbox
  // (e.g. "depmap_id", "entrez_id"). Used to give the bare id values in
  // `index_ids` a human-readable label in display contexts like hover
  // text. Optional because some legacy code paths construct responses
  // without consulting Breadbox.
  index_id_column?: string;

  // The dimension type's human-readable display name from Breadbox
  // (e.g. "Cell Line", "Gene"). Preferred over `index_id_column` as a
  // prefix in display contexts because it's uniformly legible across
  // types. Optional for the same reason as `index_id_column`.
  index_display_name?: string;

  // Real, stable identifiers from Breadbox. Use this for identity:
  // joins, lookups, selection state, filters, URL state, anything
  // persistent.
  index_ids: string[];

  // Human-readable display labels, parallel to `index_ids`. Use this
  // for any user-facing text — hover, axis ticks, list rendering.
  index_labels: string[];

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
      // Officially used to color by annotations, but other properties may
      // exist in the future.
      "color_property" | string,
      {
        label: string;
        sliceQuery?: SliceQuery;
        dataset_label?: string;
        units?: string;
        values: (string | number | null)[];
        value_type:
          | "continuous"
          | "text"
          | "categorical"
          // Only used by the legacy DE2 backend.
          // While Breadbox supports it, we don't use it.
          | "binary";
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
  id: string;
  index_type: string;
  given_id: string | null;
  name: string;
  priority: number | null;
  slice_type: string;
  units: string;
  // These will only be present if loaded by Breadbox
  // (the legacy API did not include them).
  sample_type_name?: string;
  feature_type_name?: string;
}

export type StoredContexts = Record<
  string,
  {
    name: string;
    context_type: string;

    // If version isn't present, assume version 1.
    version?: number;

    // HACK: This property is never saved in local storage. It's just a temporary
    // tag that loadContextsFromLocalStorage() creates.
    isLegacyList?: boolean;
  }
>;
