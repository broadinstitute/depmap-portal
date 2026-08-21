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

// `facet_by` also types itself as `ColorByValue` (see its own field comment
// below) rather than a dedicated `FacetByValue`. That already over-permits
// nonsensical combinations by convention rather than by the type system
// (e.g. nothing stops `facet_by: "expansion"` misuse beyond the reducer/UI
// never offering it) — "facet" and "uniform" below are two more members
// that are meaningless for `facet_by` (circular / redundant with omitting
// facet_by, respectively) in exactly that same already-accepted way. A real
// `ColorByValue`/`FacetByValue` split (excluding these two from facet_by's
// type) is additive and low-risk and can happen at any later time as a
// pure type-level change with no wire-format impact — deliberately
// deferred rather than bundled into the version-2 flip that introduced
// these two values. See ADR 0004 in @depmap/data-explorer-2/docs/adr/.
export type ColorByValue =
  | "raw_slice"
  | "aggregated_slice"
  | "property"
  | "custom"
  | "expansion"
  // Version 2 (see ADR 0001, ADR 0004): defers color entirely to
  // facet_by's own resolution — same categorical/continuous/custom-filter/
  // expansion source, same partition, same colors facet_by is already
  // computing. This is the version-2 DEFAULT (absent color_by means this),
  // not merely an available value — see CURRENT_PLOT_VERSION / the v1->v2
  // migration in DataExplorerPage/utils.ts.
  | "facet"
  // Version 2 (see ADR 0001, ADR 0004): explicit "no color, regardless of
  // facet_by" sentinel. NOT equivalent to omitting color_by (which means
  // "facet" as of version 2) — this is what a version-1 payload's absent
  // color_by (which meant "uniform") gets migrated to on read, and is also
  // available as an explicit opt-out for new plots.
  | "uniform";

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
  | "sum"
  // Sentinel — NOT a real aggregation; if anything, the opposite. It marks an
  // axis whose per-pair values come from an expansion (fetchExpandedPlot), not
  // from aggregating a slice. It rides on the required `aggregation` field to
  // preserve that field's always-present invariant without restructuring the
  // dimension type. Identity check: `dim.aggregation === "expansion"` (see
  // isExpansionDimension). It must NEVER reach Breadbox: the materializer
  // guards and the getMatrixDatasetData trap enforce that.
  | "expansion";

export type DimensionKey = "x" | "y" | "color" | "facet";
export type FilterKey =
  | "color1"
  | "color2"
  | "facet1"
  | "facet2"
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
  // The dimension's units as reported by Breadbox (e.g. "log2(TPM+1)"). The
  // sentinel "unitless" is a real Breadbox value and is also used here for any
  // dimension with no meaningful units (rank axes, correlation coefficients,
  // categorical/color dimensions, error placeholders). `string` already covers
  // "unitless"; it is named in the type so the UI can switch on it explicitly.
  units: "unitless" | string;
}

// A single expansion: fans each index entity out into one point per member of
// `context` (e.g. depmap_model × transcript). `expand_by` is a plot-level
// concept (not a per-axis flag) by design. The count is currently capped at
// one by the materializer; the type is an array to leave room for
// multi-expansion, which is deferred (see fetchExpandedPlot's header). The axis
// that *reads* each per-pair value is the one carrying the "expansion" sentinel
// on `aggregation`.
//
// How many members get shown is not recorded here. It used to be (`limit`,
// alongside an `offset` to page through the rest), but both existed only
// because the members shown were an arbitrary prefix of the context: if the
// interesting ones might be anywhere, you need to be able to reach anywhere.
// The materializer now picks the members worth showing, and how many fit is
// derived from the size of the index being expanded (see
// maxExpansionMembersFor) rather than chosen — so there is nothing left for the
// config to say about count. Deriving it is what makes that true: a number the
// config carried would go stale the moment the plot pointed at a differently
// sized dataset. Links written before that change may still carry the old
// fields; they are inert, and nothing reads them.
export interface DataExplorerExpandBy {
  slice_type: string;
  context: DataExplorerContextV2;

  // The members the user picked by hand, in the member table. Absent means
  // "restore default", which is the default and by far the common case.
  //
  // Present, it wins outright — the ranking is a suggestion and this is a
  // decision. Recording it here rather than recomputing is what makes a shared
  // link show the reader the same members the author was looking at, even as
  // the underlying data changes underneath both of them.
  //
  // Still bounded by the same cap the ranking is: it is about small multiples
  // staying legible and about not fetching N×M values, neither of which
  // deliberateness changes. Since the cap depends on the dataset, a selection
  // made against one dataset may be trimmed when read against a larger one.
  // Ids naming members outside `context` are ignored rather than honored, so
  // this can't smuggle in entities the expansion doesn't contain.
  members?: string[];
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

  // Three different counts, because a sparse dataset makes them genuinely
  // differ and the UI was previously conflating them into a claim it couldn't
  // keep ("Showing 14 of 29" when six were drawn and the cap of 14 was never
  // reachable).
  //
  // What the context resolved to, before the cap or the data had any say. The
  // widest of the three, and the least useful on its own.
  total_in_context?: number;

  // How many of those could be drawn at all — members with at least one
  // observation in EVERY expanding axis's dataset. A context names entities; a
  // dataset measures some of them, and often not most of them; two axes on
  // different datasets narrow it again to what they share. This is the number
  // that answers "could I show more than I'm seeing?", so it is the denominator
  // the member control uses, and taking it from one dataset let the control
  // offer members no selection could reach.
  //
  // An upper bound rather than an exact count when the axes differ: "has data
  // in each" is weaker than "has data in each for the same entity", which is
  // what actually puts a point on the plot. Deliberate — the exact answer means
  // fetching values for every candidate, which is the work ranking exists to
  // avoid. shown_count, computed after the values arrive, is exact.
  //
  // Undefined when it can't be known without a request nobody needs: a
  // hand-picked selection tells us nothing about the members it didn't pick,
  // and a categorical dataset can't be aggregated to find out.
  available_count?: number;

  // How many members actually contributed a drawn point. Bounded above by the
  // cap and by available_count, and the only one of the three the user can
  // literally count on screen. A member the dataset doesn't track still gets an
  // entry in `ids` — it just renders an empty panel or a legend row that
  // toggles nothing — so this is deliberately not `ids.length`.
  shown_count?: number;

  // True when members were dropped to satisfy the cap. The ones
  // kept are those that vary most across the entities being plotted, so this
  // says "there are more of these" rather than "you are missing the good ones"
  // — but the user should still be told, since nothing else on the plot
  // indicates that the member set is partial.
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
  version?: number;
  plot_type: DataExplorerPlotType;
  index_type: string;
  dimensions: Partial<Record<DimensionKey, DataExplorerPlotConfigDimension>>;

  // At most one expansion (see DataExplorerExpandBy). When present, the plot's
  // point set fans from N index entities to N×M (entity, expansion-member)
  // pairs. Absent or empty means an ordinary single-axis plot.
  expand_by?: DataExplorerExpandBy[];
  color_by?: ColorByValue;

  // `facet_by` controls which per-point categorical/continuous/custom-
  // filter source drives spatial faceting (violin tracks in density_1d,
  // x-position clustering in waterfall, small-multiples faceting in
  // scatter) — an axis fully independent from `color_by`. Unset means "no
  // faceting" in every renderer; it does NOT fall back to `color_by` (that
  // historical conflation was removed). The relationship runs the other
  // direction as of version 2: `color_by` can defer TO `facet_by` (see
  // `ColorByValue`'s `"facet"` member above), never the reverse.
  facet_by?: ColorByValue;

  // The categories the user picked by hand to get their own color or facet
  // panel. Absent means "restore default", which is the default and the common
  // case: a plot shows the categories whose points sit somewhere distinctive on
  // the axes being drawn, and collapses the rest into one bucket.
  //
  // Present, the list wins outright — the ranking is a suggestion and this is a
  // decision, so a shared link shows a reader the categories its author was
  // looking at rather than whatever the data says on the day they open it.
  //
  // Which of the two applies follows the resolved color target, not the field
  // name: when `color_by` defers to `facet_by` there is one partition, resolved
  // as target "facet", and `facet_categories` is what governs it. So the two
  // can never disagree about a partition they share.
  //
  // Still bounded by HARD_MAX_CATEGORIES. Names that aren't in the data are
  // ignored rather than honored, and if none of them survive the plot falls
  // back to choosing, rather than rendering nothing.
  color_categories?: string[];
  facet_categories?: string[];

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
    facet?: DataExplorerPlotResponseDimension;
    // "x2" is a pseudo-dimension returned by the /get_correlation endpoint
    x2?: DataExplorerPlotResponseDimension;
  };
  filters: Partial<Record<FilterKey, { name: string; values: boolean[] }>>;
  metadata: Partial<
    Record<
      // Officially used to color by and facet by annotations but any other
      // strings will be treated as data to add as hover text.
      "color_property" | "facet_property" | string,
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
  | ["dimensions", "facet", "context"]
  | ["filters", "color1"]
  | ["filters", "color2"]
  | ["filters", "facet1"]
  | ["filters", "facet2"]
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
