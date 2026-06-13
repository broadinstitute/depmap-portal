import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout, XAxisName, YAxisName } from "plotly.js";
import {
  ColorByValue,
  DataExplorerExpansion,
  DataExplorerMetadata,
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
  SliceQuery,
} from "@depmap/types";
import { linregress, pearsonr, spearmanr } from "@depmap/statistics";
import wellKnownDatasets from "../../../../../constants/wellKnownDatasets";

// HACK: Copied from the "depmap-shared" directory.
const colorPalette = {
  damaging_color: "#F4220C",
  gene_color: "#AAAAAA",
  hotspot_color: "#F4840C",
  other_conserving_color: "#2497AA",
  other_non_conserving_color: "#076075",
};

export interface DataExplorerColorPalette {
  all: string;
  other: string;
  compare1: string;
  compare2: string;
  compareBoth: string;
  qualitativeFew: string[];
  qualitativeMany: string[];
  sequentialScale: string[][];
}

export type RegressionLine = {
  b: number;
  color: string;
  hidden: boolean;
  m: number;
};

export const LEGEND_ALL = Symbol("All");
export const LEGEND_BOTH = Symbol("Both");
export const LEGEND_OTHER = Symbol("Other");
export const LEGEND_RANGE_1 = Symbol("Range 1");
export const LEGEND_RANGE_2 = Symbol("Range 2");
export const LEGEND_RANGE_3 = Symbol("Range 3");
export const LEGEND_RANGE_4 = Symbol("Range 4");
export const LEGEND_RANGE_5 = Symbol("Range 5");
export const LEGEND_RANGE_6 = Symbol("Range 6");
export const LEGEND_RANGE_7 = Symbol("Range 7");
export const LEGEND_RANGE_8 = Symbol("Range 8");
export const LEGEND_RANGE_9 = Symbol("Range 9");
export const LEGEND_RANGE_10 = Symbol("Range 10");

export type LegendKey =
  | typeof LEGEND_ALL
  | typeof LEGEND_BOTH
  | typeof LEGEND_OTHER
  | typeof LEGEND_RANGE_1
  | typeof LEGEND_RANGE_2
  | typeof LEGEND_RANGE_3
  | typeof LEGEND_RANGE_4
  | typeof LEGEND_RANGE_5
  | typeof LEGEND_RANGE_6
  | typeof LEGEND_RANGE_7
  | typeof LEGEND_RANGE_8
  | typeof LEGEND_RANGE_9
  | typeof LEGEND_RANGE_10
  | string;

const d3_category10 = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

const d3_category20 = [
  "#1f77b4",
  "#aec7e8",
  "#ff7f0e",
  "#ffbb78",
  "#2ca02c",
  "#98df8a",
  "#d62728",
  "#ff9896",
  "#9467bd",
  "#c5b0d5",
  "#8c564b",
  "#c49c94",
  "#e377c2",
  "#f7b6d2",
  "#7f7f7f",
  "#c7c7c7",
  "#bcbd22",
  "#dbdb8d",
  "#17becf",
  "#9edae5",
];

export const DEFAULT_PALETTE = {
  all: colorPalette.gene_color,
  other: colorPalette.gene_color,
  compare1: "#1A7DB6",
  compare2: "#F1DC6C",
  compareBoth: "#77BE86",
  qualitativeFew: d3_category10,
  qualitativeMany: d3_category20,
  sequentialScale: [
    ["0.0", "#FFFED8"],
    ["0.111111", "#EFF6BB"],
    ["0.222222", "#D4E9B0"],
    ["0.333333", "#A7D5B1"],
    ["0.444444", "#76BFB5"],
    ["0.555555", "#50A8B8"],
    ["0.666666", "#388BB3"],
    ["0.777777", "#2968A4"],
    ["0.888888", "#192E75"],
    ["1.0", "#0B1D4B"],
  ],
};

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const compareLegendKeys = (keyA: symbol | string, keyB: symbol | string) => {
  if (typeof keyA === "symbol") {
    return 1;
  }

  if (typeof keyB === "symbol") {
    return -1;
  }

  return collator.compare(keyA, keyB);
};

export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hex
    .replace(/^#/, "")
    .replace(/(.)/g, hex.length < 6 ? "$1$1" : "$1")
    .match(/../g)!
    .map((word) => parseInt(word, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function nullifyUnplottableValues(
  values?: number[],
  visibleFilter?: boolean[],
  dependentDimensions?: { values: unknown[] }[]
) {
  if (!values) {
    return null;
  }

  const out = [];

  for (let i = 0; i < values.length; i += 1) {
    let value: number | null = values[i];

    if (visibleFilter?.[i] === false) {
      value = null;
    }

    if (dependentDimensions) {
      for (let j = 0; j < dependentDimensions.length; j += 1) {
        if (dependentDimensions[j]?.values[i] === null) {
          value = null;
        }
      }
    }

    out.push(value);
  }

  return out;
}

// Returns the per-point categorical series that drives coloring (or, when
// the caller is using it for the grouping seam, track assignment). When
// `mode === "expansion"`, the source is `data.expansions[0]` — the per-cell
// expansion label, e.g. one transcript label per (model, transcript) point.
// When `mode` is anything else (or unset), the source is the same as before:
// the categorical color dimension, falling back to color_property metadata.
//
// Throws when `mode === "expansion"` but the response has no expansions —
// that's the runtime error that surfaces a config saying "use the expansion"
// against data that doesn't have one.
// The per-point facet-membership predicate shared by the faceted renderer
// (which dots land in panel `facet`) and the per-facet regression fit (which
// points the line is fit over), so the two can't drift — a line must be fit
// over exactly the points its panel draws. Membership only: callers add their
// own concerns (the renderer composes a color-group selector on top; the fit
// adds finite-input hygiene).
export function facetMaskFor(
  facetKeys: (string | null)[],
  facet: string,
  x: (number | null)[],
  y: (number | null)[],
  visible: boolean[]
) {
  return (i: number) =>
    visible[i] && facetKeys[i] === facet && x[i] !== null && y[i] !== null;
}

// Per-facet linear-regression stats (the LinRegInfo[] shape the regression
// table consumes), grouped by group_by, computed from a materialized response.
// The table's faceted counterpart to fetchLinearRegression's color-grouped fit
// — same row shape, so reformatLinRegTable handles either. It lives here (not
// in the services layer) because grouping needs findCategoricalSlice, which is
// a component-layer concern; the table fetches `data` and calls this.
//
// It shares the facet-membership predicate (facetMaskFor) and the fit
// (linregress) with the drawn per-facet lines, so the two agree on
// slope/intercept given the same inputs. The lines fit over the hook's
// nulled/legend-visible arrays while this fits over the raw response with
// filter-visibility — the same lines-vs-table divergence the single-panel path
// already has via fetchLinearRegression; grouping (the J2 requirement) matches.
export function computeFacetedLinReg(
  data: DataExplorerPlotResponse,
  group_by: ColorByValue,
  visible?: boolean[]
): LinRegInfo[] {
  const facetSlice = findCategoricalSlice(data, group_by);
  const xs = data.dimensions?.x?.values;
  const ys = data.dimensions?.y?.values;

  if (!facetSlice || !xs || !ys) {
    return [];
  }

  const facetKeys = facetSlice.values;
  const vis = visible || xs.map(() => true);
  const facets = [
    ...new Set(facetKeys.filter((k): k is string => k !== null)),
  ].sort();

  return facets.map((facet) => {
    const inFacet = facetMaskFor(facetKeys, facet, xs, ys, vis);
    const x: number[] = [];
    const y: number[] = [];

    for (let i = 0; i < xs.length; i += 1) {
      if (inFacet(i) && Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
        x.push(xs[i] as number);
        y.push(ys[i] as number);
      }
    }

    const pearson = pearsonr(x, y);
    const spearman = spearmanr(x, y);
    const regression = linregress(x, y);

    return {
      group_label: facet,
      number_of_points: x.length,
      pearson: pearson.statistic,
      spearman: spearman.statistic,
      slope: regression.slope,
      intercept: regression.intercept,
      p_value: regression.pvalue,
    };
  });
}

// Single pooled fit over every visible point — the ungrouped analog of
// computeFacetedLinReg, used by the regression table when an expanded plot
// has no group_by. It mirrors the single pooled line the plot draws and,
// like the faceted path, never calls fetchLinearRegression (which rejects
// the "expansion" sentinel). group_label is null, which the table renders
// the same way it renders the legacy ungrouped fit.
export function computePooledLinReg(
  data: DataExplorerPlotResponse,
  visible?: boolean[]
): LinRegInfo[] {
  const xs = data.dimensions?.x?.values;
  const ys = data.dimensions?.y?.values;

  if (!xs || !ys) {
    return [];
  }

  const vis = visible || xs.map(() => true);
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < xs.length; i += 1) {
    if (vis[i] && Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      x.push(xs[i] as number);
      y.push(ys[i] as number);
    }
  }

  const pearson = pearsonr(x, y);
  const spearman = spearmanr(x, y);
  const regression = linregress(x, y);

  return [
    {
      group_label: null,
      number_of_points: x.length,
      pearson: pearson.statistic,
      spearman: spearman.statistic,
      slope: regression.slope,
      intercept: regression.intercept,
      p_value: regression.pvalue,
    },
  ];
}

export function findCategoricalSlice(
  data: DataExplorerPlotResponse | null,
  mode?: ColorByValue
) {
  if (!data) {
    return null;
  }

  if (mode === "expansion") {
    const expansions = (data as { expansions?: DataExplorerExpansion[] })
      .expansions;
    if (!expansions || expansions.length === 0) {
      throw new Error(
        `mode "expansion" requires the response to have at least one ` +
          `expansion, but data.expansions is empty or missing.`
      );
    }
    const exp = expansions[0];
    return {
      label: exp.display_name || exp.slice_type,
      dataset_id: undefined,
      values: exp.labels.map((v) => v?.toString() || null),
      value_type: "categorical" as const,
    };
  }

  const colorDim = data.dimensions?.color;

  if (colorDim && ["text", "categorical"].includes(colorDim.value_type)) {
    return {
      label: colorDim.axis_label,
      dataset_id: colorDim.dataset_id,
      values: colorDim.values.map((v) => v?.toString() || null),
      value_type: colorDim.value_type,
    };
  }

  const color_property = data?.metadata?.color_property;

  if (
    color_property &&
    ["text", "categorical"].includes(color_property.value_type)
  ) {
    return {
      label: color_property.label,
      dataset_id: color_property.sliceQuery?.dataset_id,
      values: color_property.values.map((v) => v?.toString() || null),
      value_type: color_property.value_type,
    };
  }

  return null;
}

export function findContinuousColorSlice(
  data: DataExplorerPlotResponse | null
) {
  const colorDim = data?.dimensions?.color;

  if (colorDim?.value_type === "continuous") {
    return {
      label: colorDim.axis_label,
      dataset_id: colorDim.dataset_id,
      values: colorDim.values,
      value_type: colorDim.value_type,
    };
  }

  const color_property = data?.metadata?.color_property;

  if (color_property?.value_type === "continuous") {
    return {
      label: color_property.label,
      dataset_id: color_property.sliceQuery?.dataset_id,
      values: color_property.values as number[],
      value_type: color_property.value_type,
    };
  }

  return null;
}

export function formatDataForScatterPlot(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"]
) {
  if (!data) {
    return null;
  }

  const round = (num: number) =>
    Math.round((num + Number.EPSILON) * 1.0e7) / 1.0e7;

  const c1Values = data.filters?.color1?.values;
  const c2Values = data.filters?.color2?.values;
  const catValues = findCategoricalSlice(data, color_by)?.values;
  const contSlice = findContinuousColorSlice(data);
  const contValues = nullifyUnplottableValues(
    contSlice?.values,
    data.filters?.visible?.values,
    [data.dimensions.x, data.dimensions.y!]
  );

  let xLabel = [data.dimensions.x.axis_label, data.dimensions.x.dataset_label]
    .filter(Boolean)
    .join("<br>");

  let yLabel: string | null = null;

  if (data.dimensions.y) {
    yLabel = [data.dimensions.y.axis_label, data.dimensions.y.dataset_label]
      .filter(Boolean)
      .join("<br>");
  }

  if (data.filters.visible) {
    if (xLabel) {
      xLabel += `<br>filtered by ${data.filters.visible.name}`;
    } else {
      yLabel += `<br>filtered by ${data.filters.visible.name}`;
    }
  }

  return {
    xLabel,
    yLabel,

    x: nullifyUnplottableValues(
      data.dimensions.x.values,
      data.filters?.visible?.values
    ),

    y: nullifyUnplottableValues(
      data.dimensions?.y?.values,
      data.filters?.visible?.values
    ),

    color1: c1Values || null,
    color2: c2Values || null,
    catColorData: catValues || null,
    contColorData: contValues || null,

    hoverText: data.index_ids.map((id: string, i: number) => {
      const label = data.index_labels[i];
      const colorInfo = [];

      if (c1Values && c1Values[i] && color_by === "aggregated_slice") {
        colorInfo.push(data.filters.color1!.name);
      }

      if (c2Values && c2Values[i] && color_by === "aggregated_slice") {
        colorInfo.push(data.filters.color2!.name);
      }

      if (contValues && contValues[i] !== null) {
        const truncate = (s: string) =>
          s.length > 30 ? s.slice(0, 30) + "…" : s;

        colorInfo.push(
          [
            `<b>${truncate(contSlice!.label)}</b>`,
            round(contValues[i] as number),
          ].join(": ")
        );
      }

      const hasExpansion =
        typeof data === "object" &&
        data !== null &&
        "expansions" in data &&
        (data as { expansions: ArrayLike<unknown> }).expansions.length > 0;

      // Build the index section as: bold header (entity type) + bold
      // label + plain id. The header anchors the section's identity;
      // the label is the primary thing the user scans for; the id is
      // identity for copy/lookup. When `display_name` is missing the
      // header is skipped — falling back to `index_id_column` would
      // print "depmap id" as a header, which reads as a column name
      // rather than an entity type. The degraded form (bold label +
      // plain id, no header) is honest about what we don't know.
      const indexLines: string[] = [];
      if (hasExpansion && data.index_display_name) {
        indexLines.push(`<b>${data.index_display_name}</b>`);
      }
      indexLines.push(`<b>${label}</b>`);
      if (id !== label) {
        indexLines.push(id);
      }

      // Metadata is index-keyed (model-level for the gene/transcript
      // case), so it belongs in the index section rather than floating
      // at the bottom. In an expanded plot this puts it before the
      // section break; in a non-expanded plot it lifts metadata above
      // colorInfo, which reads more naturally — colorInfo describes the
      // point's value and belongs last.
      Object.keys(data.metadata || {}).forEach((key) => {
        let { label: hoverLabel } = data.metadata[key]!;
        const { values, dataset_label } = data.metadata[key]!;

        if (dataset_label) {
          hoverLabel += " " + dataset_label;
        }

        hoverLabel =
          hoverLabel.length > 25 ? `${hoverLabel.substr(0, 25)}…` : hoverLabel;

        let val = values[i] != null ? values[i]!.toString() : "<b>N/A</b>";
        val = val.length > 40 ? `${val.substr(0, 40)}…` : val;

        indexLines.push(`${hoverLabel}: ${val}`);
      });

      // Build expansion sections, one per expansion. Each mirrors the
      // index pattern (bold header + bold label + plain id) and is
      // preceded by a blank line so the section break is obvious. The
      // header is skipped when `display_name` is missing for the same
      // reason as in the index section: "transcript" (lowercase
      // slice_type) reads as a machine name, not an entity label.
      const expansionSections: string[] = [];
      const expansions = (data as { expansions?: DataExplorerExpansion[] })
        .expansions;
      if (expansions) {
        expansions.forEach((exp) => {
          const expLabel = exp.labels[i];
          const expId = exp.ids[i];
          expansionSections.push(""); // blank line between sections
          if (exp.display_name) {
            expansionSections.push(`<b>${exp.display_name}</b>`);
          }
          expansionSections.push(`<b>${expLabel}</b>`);
          if (expId !== expLabel) {
            expansionSections.push(expId);
          }
        });
      }

      return [...indexLines, ...expansionSections, ...colorInfo].join("<br>");
    }),

    annotationText: data.index_ids.map((id: string, i: number) => {
      const label = data.index_labels[i];

      if (id !== label) {
        return `<b>${label}</b>`;
      }

      return `<b>${id}</b>`;
    }),
  };
}

// Waterfall's x-positions are reassigned to cluster bars by group. Today
// that clustering uses `formatted.catColorData` (the color-side categorical),
// because color and group were conflated. With the split, the clustering
// uses `groupData` when supplied, falling back to `catColorData` for the
// converged case. Similarly `sortedGroupKeys` replaces the historical
// `sortedLegendKeys` parameter — its meaning was always "the order of
// clusters along x" rather than "the legend display order."
export function formatDataForWaterfall(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"],
  sortedGroupKeys?: (string | symbol)[],
  groupData?: (string | null)[] | null
) {
  if (!data) {
    return null;
  }

  const formatted = formatDataForScatterPlot(data, color_by);

  if (!formatted || !sortedGroupKeys) {
    return formatted;
  }

  // Clustering source: prefer the explicit groupData (group-side categorical)
  // when supplied; otherwise reuse the color-side catColorData, matching
  // pre-split behavior.
  const clusterBy = (groupData ?? formatted.catColorData) as
    | (string | null)[]
    | null;

  if (!clusterBy) {
    return formatted;
  }

  // Bucket each point's original index by its category. The previous
  // implementation built `groups[category] = { start, length }` and
  // assumed every category's points occupied a contiguous block in the
  // input. That held for plain waterfall (rank-sorted upstream by
  // fetchWaterfall, where same-color points end up adjacent) but
  // breaks for the expanded path, where materialization is row-major
  // over (logical_i, j) and category labels (e.g. transcript) cycle
  // every M positions. The bucket structure makes the loop work
  // regardless of input ordering.
  //
  // Note: `length` continues to include invisible points, matching
  // the previous code's behavior of using `clusterBy.length` (not
  // visible-count) for the per-category sum. The "leave a gap" logic
  // below compares `length` to `minLength`, where `minLength` is
  // computed against the visible domain — so small categories
  // (visible or not) get extra padding around them. Preserving that
  // as-is rather than reinterpreting.
  const buckets: Record<string | symbol, number[]> = {};
  for (let i = 0; i < clusterBy.length; i += 1) {
    const category = clusterBy[i] || LEGEND_OTHER;
    (buckets[category] ||= []).push(i);
  }

  // Within-cluster rank: sort each bucket's indices by their y value
  // ascending so that the x positions assigned by the loop below
  // produce the "snake going up" shape characteristic of a waterfall.
  // Without this, indices are walked in materialization order, which
  // for the expanded path is row-major over (logical_i, j) and has no
  // relationship to the y value — producing a "flame" of intermixed
  // values within each cluster.
  //
  // Nulls sort first (smallest x within their cluster), matching
  // fetchWaterfall's global sort behavior. The comparator pulls them
  // out before the numeric comparison so they end up at the low-x end
  // regardless of where they'd otherwise land. Sort is stable, so ties
  // (including the common "lots of points with value 0" case) preserve
  // materialization order — keeps selection / hover behavior deterministic.
  const yValues = data?.dimensions?.y?.values as (number | null)[] | undefined;
  if (yValues) {
    Object.values(buckets).forEach((indices) => {
      indices.sort((a, b) => {
        const va = yValues[a];
        const vb = yValues[b];
        if (va === vb) return 0;
        if (va === null || va === undefined) return -1;
        if (vb === null || vb === undefined) return 1;
        return va < vb ? -1 : 1;
      });
    });
  }

  let j = 0;
  const x: number[] = [];
  const visible = data.filters?.visible?.values;
  const domain = visible ? visible.filter(Boolean).length : clusterBy.length;
  const minLength = domain / sortedGroupKeys.length;

  sortedGroupKeys.forEach((key) => {
    const indices = buckets[key];

    // A category in sortedGroupKeys with no points in `clusterBy` is
    // unusual but possible (legend key with no data). Skip cleanly.
    if (!indices || indices.length === 0) {
      return;
    }

    const length = indices.length;

    if (length < minLength && j > 0) {
      j += Math.floor(minLength - length / 2);
    }

    for (const i of indices) {
      if (!visible || visible[i]) {
        x[i] = j;
        j++;
      }
    }

    if (length < minLength) {
      j += Math.floor(minLength - length / 2);
    }
  });

  return { ...formatted, x };
}

function colorMetadataChanged(
  ma?: DataExplorerMetadata,
  mb?: DataExplorerMetadata
) {
  const a = ma?.color_property;
  const b = mb?.color_property;

  if (!a && !b) {
    return false;
  }

  if (!a) {
    return true;
  }

  if (!b) {
    return true;
  }

  if ("slice_id" in a && "slice_id" in b) {
    return a.slice_id !== b.slice_id;
  }

  const sqA = a as SliceQuery;
  const sqB = b as SliceQuery;

  return (
    sqA.dataset_id !== sqB.dataset_id ||
    sqA.identifier !== sqB.identifier ||
    sqA.identifier_type !== sqB.identifier_type
  );
}

export function useLegendState(
  plotConfig: DataExplorerPlotConfig,
  legendKeysWithNoData?: any
) {
  const prevPlotConfig = useRef(plotConfig);
  const recentClickKey = useRef<string | symbol | null>(null);
  const recentClickMap = useRef<Record<string, string> | null>(null);
  const [hiddenLegendValues, setHiddenLegendValues] = useState(() => new Set());

  useEffect(() => {
    let hasChanges = false;

    if (
      colorMetadataChanged(prevPlotConfig.current.metadata, plotConfig.metadata)
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.color1?.name !==
      plotConfig.filters?.color1?.name
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.color2?.name !==
      plotConfig.filters?.color2?.name
    ) {
      hasChanges = true;
    }

    if (
      Boolean(prevPlotConfig.current.dimensions.color?.context) !==
      Boolean(plotConfig.dimensions.color?.context)
    ) {
      hasChanges = true;
    }

    if (hasChanges) {
      setHiddenLegendValues(new Set());
    }

    prevPlotConfig.current = plotConfig;
  }, [plotConfig]);

  useEffect(() => {
    if (legendKeysWithNoData) {
      setHiddenLegendValues(legendKeysWithNoData);
    } else {
      setHiddenLegendValues(new Set());
    }
  }, [legendKeysWithNoData]);

  const onClickLegendItem = useCallback(
    (key: string | symbol, catColorMap: Record<string, string>) => {
      if (recentClickKey.current === key) {
        setHiddenLegendValues((prev) => {
          const allKeys = new Set(
            Reflect.ownKeys(recentClickMap.current as object)
          );

          if (prev.has(key) && prev.size !== allKeys.size) {
            const next = new Set(allKeys);
            next.delete(key);
            return next;
          }

          return new Set();
        });

        return;
      }

      recentClickKey.current = key;
      recentClickMap.current = catColorMap;

      setTimeout(() => {
        recentClickKey.current = null;
      }, 300);

      setHiddenLegendValues((prev) => {
        const next = new Set(prev);

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      });
    },
    []
  );

  const handleClickHideAll = useCallback(
    (catColorMap: Record<string, string>) => {
      setHiddenLegendValues(() => {
        const allKeys = new Set(Reflect.ownKeys(catColorMap as object));
        return new Set(allKeys);
      });
    },
    []
  );

  const handleClickShowAll = useCallback(() => {
    setHiddenLegendValues(new Set());
  }, []);

  return {
    hiddenLegendValues: hiddenLegendValues as Set<LegendKey>,
    onClickLegendItem,
    handleClickShowAll,
    handleClickHideAll,
  };
}

export function calcMinMax(values: (number | null)[]) {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value != null && value < min) {
      min = value;
    }

    if (value != null && value > max) {
      max = value;
    }
  }

  return { min, max };
}

export function calcBins(values: (number | null)[]) {
  if (values.length === 0) {
    return null;
  }

  const bins = [];
  const { min, max } = calcMinMax(values);

  const NUM_BINS = 10;
  const binSize = (max - min) / NUM_BINS;
  let binStart = min;

  for (let i = 0; i < NUM_BINS; i += 1) {
    const binEnd = i === NUM_BINS - 1 ? max : binStart + binSize;
    bins.push([binStart, binEnd]);
    binStart = binEnd;
  }

  return {
    [LEGEND_RANGE_1]: bins[0],
    [LEGEND_RANGE_2]: bins[1],
    [LEGEND_RANGE_3]: bins[2],
    [LEGEND_RANGE_4]: bins[3],
    [LEGEND_RANGE_5]: bins[4],
    [LEGEND_RANGE_6]: bins[5],
    [LEGEND_RANGE_7]: bins[6],
    [LEGEND_RANGE_8]: bins[7],
    [LEGEND_RANGE_9]: bins[8],
    [LEGEND_RANGE_10]: bins[9],
  };
}

export function calcVisibility(
  data: DataExplorerPlotResponse | null,
  hiddenLegendValues: any,
  continuousBins: any,
  hide_points?: boolean,
  color_by?: ColorByValue
) {
  if (!data) {
    return null;
  }

  if (hide_points || hiddenLegendValues.has(LEGEND_ALL)) {
    return data.dimensions.x.values.map(() => false);
  }

  const contKeys = Reflect.ownKeys(continuousBins || {});
  const contValues = findContinuousColorSlice(data)?.values;

  if (contValues) {
    return contValues.map((value: number) => {
      let out = true;

      contKeys.forEach((key, index) => {
        if (hiddenLegendValues.has(key)) {
          const [binStart, binEnd] = continuousBins[key];

          if (value !== null && value >= binStart && value < binEnd) {
            out = false;
          }

          if (index === contKeys.length - 1 && value === binEnd) {
            out = false;
          }
        }
      });

      if (hiddenLegendValues.has(LEGEND_OTHER) && value === null) {
        out = false;
      }

      return out;
    });
  }

  const catValues = findCategoricalSlice(data, color_by)?.values;

  if (catValues) {
    const hideOthers = hiddenLegendValues.has(LEGEND_OTHER);

    return catValues.map((value) => {
      if (hiddenLegendValues.has(value)) {
        return false;
      }

      if (hideOthers && !value) {
        return false;
      }

      return true;
    });
  }

  const c1Values = data.filters?.color1?.values;
  const c2Values = data.filters?.color2?.values;
  const visiblePoints = data.dimensions.x.values.map(() => true);

  if (c1Values && hiddenLegendValues.has(data.filters.color1!.name)) {
    c1Values.forEach((value: boolean, i: number) => {
      if (value && !(c2Values || [])[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (c2Values && hiddenLegendValues.has(data.filters.color2!.name)) {
    c2Values.forEach((value: boolean, i: number) => {
      if (value && !(c1Values || [])[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (c1Values && c2Values && hiddenLegendValues.has(LEGEND_BOTH)) {
    c1Values.forEach((value: boolean, i: number) => {
      if (value && c2Values[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (hiddenLegendValues.has(LEGEND_OTHER)) {
    const primary = c1Values || c2Values;
    const other = c2Values || [];

    primary?.forEach((value: boolean, i: number) => {
      if (!value && !other[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  return visiblePoints;
}

export function getLegendKeysWithNoData(
  data: any,
  continuousBins: any,
  color_by?: ColorByValue
) {
  const catData = findCategoricalSlice(data, color_by);
  const visible = data?.filters?.visible;

  if (catData && visible) {
    const counts: Record<string, number> = {};
    const unusedKeys = new Set();

    for (let i = 0; i < catData.values.length; i += 1) {
      const category = catData.values[i];

      if (category) {
        counts[category] = counts[category] || 0;
        counts[category] += visible.values[i] ? 1 : 0;
      }
    }

    Object.keys(counts).forEach((category) => {
      if (counts[category] === 0) {
        unusedKeys.add(category);
      }
    });

    return unusedKeys as Set<LegendKey>;
  }

  const contData = findContinuousColorSlice(data);

  if (!contData || !continuousBins) {
    return null;
  }

  const out: any = [];
  const len = contData.values.length;
  const keys = Reflect.ownKeys(continuousBins);
  const unusedKeys = new Set(keys);

  for (let i = 0; i < len; i += 1) {
    const value = contData.values[i];
    let found = false;

    if (value === null) {
      out[i] = LEGEND_OTHER;
      found = true;
      unusedKeys.delete(LEGEND_OTHER);
    }

    keys.forEach((key: any, j) => {
      const [binStart, binEnd] = (continuousBins as any)[key];

      if (
        !found &&
        data.dimensions?.x.values[i] !== null &&
        data.dimensions?.y?.values[i] !== null &&
        ((value >= binStart && value < binEnd) ||
          (j === keys.length - 1 && value >= binStart && value <= binEnd))
      ) {
        found = true;
        out[i] = key;
        unusedKeys.delete(key);
      }
    });
  }

  return unusedKeys as Set<LegendKey>;
}

const hasSomeMatchingTrueValue = (a: boolean[], b: boolean[]) => {
  const len = a.length;

  for (let i = 0; i < len; i += 1) {
    if (a[i] && b[i]) {
      return true;
    }
  }

  return false;
};

const hasSomeUniqueValues = (a: boolean[], b: boolean[] | undefined) => {
  if (!b) {
    return true;
  }

  const len = a.length;

  for (let i = 0; i < len; i += 1) {
    if (a[i] && !b[i]) {
      return true;
    }
  }

  return false;
};

const hasSomeNullValuesUniqueToDimension = (
  dimensions: any,
  dimensionKey: string
) => {
  const otherDims = Object.keys(dimensions).filter(
    (key) => key !== dimensionKey
  );

  const { values } = dimensions[dimensionKey];
  const len = values.length;

  for (let i = 0; i < len; i += 1) {
    if (
      values[i] === null &&
      otherDims.every((key) => dimensions[key].values[i] !== null)
    ) {
      return true;
    }
  }

  return false;
};

const hasSomeUncoloredPoints = (
  c1Values: boolean[] | undefined,
  c2Values: boolean[] | undefined,
  dimensions: Record<string, { values: unknown[] }> | null
) => {
  const len = c1Values?.length || c2Values?.length || 0;

  for (let i = 0; i < len; i += 1) {
    if (c1Values && c2Values) {
      if (
        !c1Values[i] &&
        !c2Values[i] &&
        dimensions?.x?.values[i] !== null &&
        dimensions?.y?.values[i] !== null
      ) {
        return true;
      }
    } else if ((c1Values && !c1Values[i]) || (c2Values && !c2Values[i])) {
      return true;
    }
  }

  return false;
};

export function categoricalDataToValueCounts(
  catData: (string | symbol | null)[] | null | undefined,
  visible: boolean[]
) {
  const countMap: Map<string | symbol | null, number> = new Map();

  if (!catData) {
    return countMap;
  }

  for (let i = 0; i < catData.length; i += 1) {
    if (visible[i]) {
      const category = catData[i];
      const total = countMap.get(category) || 0;
      countMap.set(category, total + 1);
    }
  }

  return countMap;
}

const findPlottableCategories = (
  catValues: string[],
  dimensions: Record<string, { values: unknown[] }> | null,
  visible: boolean[]
) => {
  const out = new Set<string>();

  if (!dimensions) {
    return out;
  }

  for (let i = 0; i < catValues.length; i += 1) {
    const category = catValues[i];

    if (!out.has(category) && visible[i]) {
      const plottable = [dimensions.x, dimensions.y]
        .filter(Boolean)
        .every((dim) => dim.values[i] !== null);

      if (plottable) {
        out.add(category);
      }
    }
  }

  return out;
};

const hasPlottableNulls = (
  values: string[] | null,
  dimensions: Record<string, { values: unknown[] }> | null,
  visible: boolean[]
) => {
  if (!values) {
    return false;
  }

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value === null) {
      const dimensionsAreNotNull = Object.keys(dimensions || {})
        .filter((key) => key !== "color")
        .every((key) => dimensions![key].values[i] !== null);

      if (dimensionsAreNotNull && visible[i]) {
        return true;
      }
    }
  }

  return false;
};

function makeCategoricalColorMap(
  values: string[] | null,
  dimensions: Record<string, { dataset_id: string; values: unknown[] }> | null,
  filters: Record<string, { values: boolean[] }> | null,
  metadata: DataExplorerMetadata | null,
  palette: DataExplorerColorPalette
) {
  const out: Map<LegendKey, string> = new Map();

  if (!values) {
    return out;
  }

  const visible = filters?.visible?.values || Array(values.length).fill(true);
  const counts = categoricalDataToValueCounts(values, visible);

  const plottableCategories = findPlottableCategories(
    values,
    dimensions,
    visible
  );

  const keys = ([...counts.keys()].filter(Boolean) as string[])
    .filter((key) => counts.get(key)! > 0 && plottableCategories.has(key))
    .sort(collator.compare);

  const legacySliceId = (metadata?.color_property as { slice_id?: string })
    ?.slice_id;

  if (
    legacySliceId?.startsWith("slice/mutations_prioritized/") ||
    dimensions?.color?.dataset_id === wellKnownDatasets.mutations_prioritized
  ) {
    const fixedColors = {
      "Other conserving": colorPalette.other_conserving_color,
      "Other non-conserving": colorPalette.other_non_conserving_color,
      Damaging: colorPalette.damaging_color,
      Hotspot: colorPalette.hotspot_color,
      Other: colorPalette.other_conserving_color,
    };

    keys.forEach((key) => {
      out.set(
        key,
        key in fixedColors
          ? fixedColors[key as keyof typeof fixedColors]
          : palette.other
      );
    });
  } else {
    const colors =
      keys.length <= palette.qualitativeFew.length
        ? palette.qualitativeFew
        : palette.qualitativeMany;

    keys.forEach((key, i) => {
      out.set(key, colors[i % colors.length]);
    });
  }

  if (hasPlottableNulls(values, dimensions, visible)) {
    out.set(LEGEND_OTHER, palette.other);
  }

  return out;
}

export function getColorMap(
  data: any,
  plotConfig: any,
  palette: DataExplorerColorPalette,
  sortedLegendKeys?: any
): Map<LegendKey, string> {
  if (!data || data.dimensions?.color?.values?.length === 0) {
    return new Map([[LEGEND_ALL, palette.all]]);
  }

  let colorMap: Map<LegendKey, string> = new Map();

  const catSlice = findCategoricalSlice(data, plotConfig.color_by);
  const contSlice = findContinuousColorSlice(data);

  if (catSlice) {
    colorMap = makeCategoricalColorMap(
      catSlice.values as string[],
      data.dimensions,
      data.filters,
      data.metadata,
      palette
    );
  }

  if (contSlice) {
    const entries = [
      [LEGEND_RANGE_1, palette.sequentialScale[0][1]],
      [LEGEND_RANGE_2, palette.sequentialScale[1][1]],
      [LEGEND_RANGE_3, palette.sequentialScale[2][1]],
      [LEGEND_RANGE_4, palette.sequentialScale[3][1]],
      [LEGEND_RANGE_5, palette.sequentialScale[4][1]],
      [LEGEND_RANGE_6, palette.sequentialScale[5][1]],
      [LEGEND_RANGE_7, palette.sequentialScale[6][1]],
      [LEGEND_RANGE_8, palette.sequentialScale[7][1]],
      [LEGEND_RANGE_9, palette.sequentialScale[8][1]],
      [LEGEND_RANGE_10, palette.sequentialScale[9][1]],
    ] as [LegendKey, string][];
    colorMap = new Map(entries);
  }

  if (data.filters?.color1) {
    if (
      hasSomeUniqueValues(
        data.filters.color1.values,
        data.filters.color2?.values
      )
    ) {
      const { name } = data.filters.color1;
      colorMap.set(name, palette.compare1);
    }
  }

  if (data.filters?.color2) {
    if (
      hasSomeUniqueValues(
        data.filters.color2.values,
        data.filters.color1?.values
      )
    ) {
      const { name } = data.filters.color2;
      colorMap.set(name, palette.compare2);
    }
  }

  if (
    data.filters?.color1 &&
    data.filters?.color2 &&
    hasSomeMatchingTrueValue(
      data.filters.color1.values,
      data.filters.color2.values
    )
  ) {
    colorMap.set(LEGEND_BOTH, palette.compareBoth);
  }

  if (data.filters?.color1 || data.filters?.color2) {
    if (
      hasSomeUncoloredPoints(
        data.filters?.color1?.values,
        data.filters?.color2?.values,
        data.dimensions
      )
    ) {
      colorMap.set(LEGEND_OTHER, palette.other);
    }
  }

  if (
    data.dimensions.color &&
    hasSomeNullValuesUniqueToDimension(data.dimensions, "color")
  ) {
    colorMap.set(LEGEND_OTHER, palette.other);
  }

  if (colorMap.size === 0) {
    colorMap.set(LEGEND_ALL, palette.all);
  }

  if (sortedLegendKeys) {
    const sortedColorMap: typeof colorMap = new Map();

    sortedLegendKeys.forEach((key: LegendKey) => {
      sortedColorMap.set(key, colorMap.get(key)!);
    });

    colorMap = sortedColorMap;
  }

  return colorMap;
}

export function countExclusivelyTrueValues(
  inGroup: (boolean | null)[] | null,
  outGroup: (boolean | null)[] | null,
  visible: boolean[]
) {
  let sum = 0;

  if (!inGroup) {
    return sum;
  }

  for (let i = 0; i < inGroup.length; i += 1) {
    sum += visible[i] && inGroup[i] && !outGroup?.[i] ? 1 : 0;
  }

  return sum;
}

export function countInclusivelyTrueValues(
  inGroup: (boolean | null)[] | null,
  outGroup: (boolean | null)[] | null,
  visible: boolean[]
) {
  let sum = 0;

  if (!inGroup || !outGroup) {
    return sum;
  }

  for (let i = 0; i < inGroup.length; i += 1) {
    sum += visible[i] && inGroup[i] && outGroup[i] ? 1 : 0;
  }

  return sum;
}

export const ceil = (n: number, p: number) => Math.ceil(n * p) / p;
export const floor = (n: number, p: number) => Math.floor(n * p) / p;

export function precision(n: number) {
  const decimalPart = `${n}`.split(".")[1];

  if (!decimalPart) {
    return 1;
  }

  let e = 10;

  for (let i = 0; i < decimalPart.length; i += 1) {
    if (decimalPart[i] !== "0") {
      return e * 10;
    }

    e *= 10;
  }

  return 100;
}

export type ContinuousBins = ReturnType<typeof calcBins>;

export function categoryToDisplayName(
  category: LegendKey,
  data: {
    dimensions?: {
      color?: object;
    };
    filters: {
      color1?: { name: string };
      color2?: { name: string };
    };
  },
  continuousBins: ContinuousBins
) {
  if (category === LEGEND_BOTH) {
    return `Both (${[data.filters.color1!.name, data.filters.color2!.name].join(
      " & "
    )})`;
  }

  if (category === LEGEND_ALL) {
    return "All";
  }

  if (category === LEGEND_OTHER) {
    const catSlice = findCategoricalSlice(data as DataExplorerPlotResponse);
    const hasOther = catSlice?.values.some(
      (val) => val === "other" || val === "Other"
    );

    return continuousBins || hasOther ? "N/A" : "Other";
  }

  if (typeof category === "symbol") {
    if (!continuousBins) {
      throw new Error("Can't create legend label without `continuousBins`.");
    }

    const [binStart, binEnd] = continuousBins[category];
    const p = precision(Math.abs(binEnd - binStart));

    if (!Number.isFinite(binStart) || !Number.isFinite(binEnd)) {
      return "No data";
    }

    return [ceil(binStart, p), floor(binEnd, p)];
  }

  return category;
}

const sortLegendKeys = (
  dimensionValues: (number | null)[],
  visibleValues: boolean[] | null,
  catData: any,
  sort_by: string = "alphabetical"
) => {
  if (sort_by === "mean_values_asc" || sort_by === "mean_values_desc") {
    const meansByCategory: Map<LegendKey, [number, number]> = new Map();

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const mean = meansByCategory.get(legendKey);
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        if (!mean) {
          meansByCategory.set(legendKey, [value, 1]);
        } else {
          const [sum, divisor] = mean;
          meansByCategory.set(legendKey, [sum + value, divisor + 1]);
        }
      }
    }

    return [...meansByCategory.keys()].sort((keyA, keyB) => {
      if (keyA === LEGEND_OTHER) {
        return 1;
      }

      if (keyB === LEGEND_OTHER) {
        return -1;
      }

      const [sumA, divisorA] = meansByCategory.get(keyA)!;
      const [sumB, divisorB] = meansByCategory.get(keyB)!;
      const a = sumA / divisorA;
      const b = sumB / divisorB;

      return sort_by === "mean_values_asc" ? a - b : b - a;
    });
  }

  if (sort_by === "alphabetical") {
    const representedKeys = new Set<string>();

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        representedKeys.add(legendKey);
      }
    }

    return [...representedKeys].sort(compareLegendKeys);
  }

  if (sort_by === "num_points") {
    const numPointsByCategory = new Map<LegendKey, number>();
    const meansByCategory: any = {};

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];
      const legendKey = key === null ? LEGEND_OTHER : key;
      const mean = meansByCategory[legendKey];
      const value = dimensionValues[i];

      if (value !== null && (!visibleValues || visibleValues[i])) {
        const prev = numPointsByCategory.get(legendKey) || 0;
        numPointsByCategory.set(legendKey, prev + 1);

        if (!mean) {
          meansByCategory[legendKey] = [value, 1];
        } else {
          const [sum, divisor] = meansByCategory[legendKey];
          meansByCategory[legendKey] = [sum + value, divisor + 1];
        }
      }
    }

    return [...numPointsByCategory.keys()].sort((keyA, keyB) => {
      if (keyA === LEGEND_OTHER) {
        return 1;
      }

      if (keyB === LEGEND_OTHER) {
        return -1;
      }

      const a = numPointsByCategory.get(keyA)!;
      const b = numPointsByCategory.get(keyB)!;

      if (a === b) {
        // use mean to break ties
        const [sumA, divisorA] = meansByCategory[keyA];
        const [sumB, divisorB] = meansByCategory[keyB];
        const meanA = sumA / divisorA;
        const meanB = sumB / divisorB;

        return meanA - meanB;
      }

      return b - a;
    });
  }

  const valuesByCategory = new Map<LegendKey, number>();

  for (let i = 0; i < catData.values.length; i += 1) {
    const key = catData.values[i];
    const legendKey = key === null ? LEGEND_OTHER : key;
    const minOrMax = valuesByCategory.get(legendKey);
    const value = dimensionValues[i];

    if (value !== null && (!visibleValues || visibleValues[i])) {
      if (
        minOrMax === undefined ||
        (sort_by === "min_values" && value < minOrMax) ||
        (sort_by === "max_values" && value > minOrMax)
      ) {
        valuesByCategory.set(legendKey, value);
      }
    }
  }

  return [...valuesByCategory.keys()].sort((keyA, keyB) => {
    if (keyA === LEGEND_OTHER) {
      return 1;
    }

    if (keyB === LEGEND_OTHER) {
      return -1;
    }

    const a = valuesByCategory.get(keyA)!;
    const b = valuesByCategory.get(keyB)!;

    return sort_by === "min_values" ? a - b : b - a;
  });
};

const sortLegendKeys1D = (
  data: any,
  catData: any,
  sort_by: string | undefined,
  includeEmpty = false
) => {
  const visibleValues = data.filters?.visible
    ? data.filters.visible.values
    : null;

  if (includeEmpty) {
    // Expanded plots keep a track for every windowed transcript, including
    // ones the dataset doesn't measure (all-null), which sortLegendKeys would
    // otherwise drop. Sort the *measured* transcripts normally — respecting
    // sort_by — then fold the empty ones in: merged alphabetically for an
    // alphabetical sort, or appended at the end for value-based sorts (an
    // all-null group has no value to sort by). This preserves sort_by for the
    // groups that have data while still surfacing the "(no data)" placeholders.
    const sorted = sortLegendKeys(
      data.dimensions.x.values,
      visibleValues,
      catData,
      sort_by
    );

    const seen = new Set(sorted);
    const empties: (string | symbol)[] = [];

    for (let i = 0; i < catData.values.length; i += 1) {
      const key = catData.values[i];

      if (key !== null && !seen.has(key)) {
        seen.add(key);
        empties.push(key);
      }
    }

    if (empties.length === 0) {
      return sorted;
    }

    if (!sort_by || sort_by === "alphabetical") {
      return [...sorted, ...empties].sort(compareLegendKeys);
    }

    return [...sorted, ...empties.sort(compareLegendKeys)];
  }

  return sortLegendKeys(
    data.dimensions.x.values,
    visibleValues,
    catData,
    sort_by
  );
};

export const sortLegendKeysWaterfall = (
  data: any,
  catData: any,
  sort_by: string | undefined
) => {
  const visibleValues = data.filters?.visible
    ? data.filters.visible.values
    : null;

  return sortLegendKeys(
    data.dimensions.y.values,
    visibleValues,
    catData,
    sort_by
  );
};

export function continuousValuesToLegendKeySeries(
  contValues: (number | null)[],
  continuousBins: ContinuousBins,
  visible?: boolean[]
) {
  const series: any = [];
  const len = contValues.length;
  const keys = Reflect.ownKeys(continuousBins || {});
  const unusedKeys = new Set(keys);

  for (let i = 0; i < len; i += 1) {
    const value = contValues[i];
    const isVisible = !visible || visible[i];
    let found = false;

    if (value === null) {
      series[i] = LEGEND_OTHER;
      found = true;
      unusedKeys.delete(LEGEND_OTHER);
    }

    keys.forEach((key: any, j) => {
      const [binStart, binEnd] = (continuousBins as any)[key];
      const isLastBin = j === keys.length - 1;

      if (
        !found &&
        value !== null &&
        isVisible &&
        value >= binStart &&
        (value < binEnd || (isLastBin && value === binEnd))
      ) {
        found = true;
        series[i] = key;
        unusedKeys.delete(key);
      }
    });
  }

  return [series, unusedKeys];
}

// Computes the per-point legend-key series for a single mode (color_by or
// group_by). The same logic that calcDensityStats used to do inline; pulled
// out so we can call it once for the coloring concern and (when modes
// differ) again for the grouping concern.
//
// Each branch corresponds to a category of color/group source:
//   - "custom"               → color1/color2 filter values
//   - categorical fall-through → catData (mode-aware: expansion when applicable,
//                                otherwise existing color-dim / color_property)
//   - continuous fall-through  → contData (binned)
//
// The "custom" branch only fires when color1/color2 are actually present;
// otherwise we fall through. That matches the existing auto-dispatch and
// keeps callers that don't set mode explicitly behaving the same as today.
function computeDensitySeriesForMode(
  data: any,
  continuousBins: any,
  sort_by: string | undefined,
  mode: ColorByValue | undefined,
  includeEmpty = false
): {
  series: any[] | null;
  unusedKeys: Set<unknown>;
  sortedKeys?: any[];
} {
  const color1 = data?.filters?.color1;
  const color2 = data?.filters?.color2;
  const visible = data?.filters?.visible;

  const catData = findCategoricalSlice(data, mode);

  // Custom (color1/color2 filter) branch. It owns coloring when the mode is
  // "custom"/unset, and also when an explicit non-"expansion" mode has no
  // categorical source of its own — e.g. aggregated_slice/raw_slice with a
  // color1/color2 filter but no color dimension. Without that fallback the
  // color side returns no series at all, and the renderer then builds zero
  // point traces (every point vanishes). We still never let filters override
  // the "expansion" group side or a real categorical color dimension.
  const useCustomColoring =
    Boolean(color1 || color2) &&
    (mode === "custom" ||
      mode === undefined ||
      (mode !== "expansion" && !catData));

  if (useCustomColoring) {
    const out: any[] = [];
    const len = (color1 || color2).values.length;
    const unusedKeys = new Set(
      color1 && color2 ? [LEGEND_BOTH, LEGEND_OTHER] : [LEGEND_OTHER]
    );

    for (let i = 0; i < len; i += 1) {
      if (color1?.values[i] && color2?.values[i]) {
        out[i] = LEGEND_BOTH;

        if (!visible || visible.values[i]) {
          unusedKeys.delete(LEGEND_BOTH);
        }
      } else if (color1?.values[i]) {
        out[i] = color1.name;
      } else if (color2?.values[i]) {
        out[i] = color2.name;
      } else {
        out[i] = LEGEND_OTHER;

        if (!visible || visible.values[i]) {
          unusedKeys.delete(LEGEND_OTHER);
        }
      }
    }

    return { series: out, unusedKeys };
  }

  if (catData) {
    const counts: Record<string, number> = {};
    const unusedKeys = new Set<unknown>();

    if (visible) {
      for (let i = 0; i < catData.values.length; i += 1) {
        const category = catData.values[i];

        if (category) {
          counts[category] = counts[category] || 0;
          counts[category] +=
            visible.values[i] && data.dimensions.x.values[i] !== null ? 1 : 0;
        }
      }

      Object.keys(counts).forEach((category) => {
        if (counts[category] === 0) {
          unusedKeys.add(category);
        }
      });
    }

    return {
      series: catData.values.map((x: unknown) =>
        x === null ? LEGEND_OTHER : x
      ),
      unusedKeys,
      sortedKeys: sortLegendKeys1D(data, catData, sort_by, includeEmpty),
    };
  }

  // Expansion is always categorical; if mode === "expansion" we never reach
  // contData. Other modes can fall through to a continuous color source.
  if (mode !== "expansion") {
    const contData = findContinuousColorSlice(data);
    if (contData) {
      const [series, unusedKeys] = continuousValuesToLegendKeySeries(
        contData.values,
        continuousBins,
        data.filters?.visible?.values
      );

      return { series, unusedKeys };
    }
  }

  return { series: null, unusedKeys: new Set() };
}

// Returns the per-point series for both coloring and grouping, plus the
// associated legend metadata. When `group_by` is unset (or equal to
// `color_by`), the grouping arrays are the same references as the coloring
// arrays — no extra work, no behavior change. When they differ, both arrays
// are computed independently from the same response and the renderer is
// expected to consume each for its respective role: colorData drives
// bgcolor, groupData drives violin-track assignment.
export function calcDensityStats(
  data: any,
  continuousBins: any,
  sort_by: string | undefined,
  color_by?: ColorByValue,
  group_by?: ColorByValue,
  isExpanded = false
) {
  const colorMode = color_by;

  const colorSide = computeDensitySeriesForMode(
    data,
    continuousBins,
    sort_by,
    colorMode
  );

  // Expand-by world: group_by is fully decoupled from color_by. An unset
  // group_by means "no grouping" — a single "all" track — NOT the legacy
  // `group_by ?? color_by` inheritance. The fallback below survives only when
  // there's no expansion (the ConfigurationPanel/legacy world), preserving
  // existing behavior there. (Color still drives point color via colorSide.)
  if (isExpanded && !group_by) {
    return {
      colorData: colorSide.series,
      groupData: colorSide.series
        ? colorSide.series.map(() => LEGEND_ALL)
        : null,
      unusedKeys: colorSide.unusedKeys as Set<LegendKey>,
      sortedColorKeys: colorSide.sortedKeys,
      sortedGroupKeys: [LEGEND_ALL],
    };
  }

  const groupMode = group_by ?? color_by;

  // Reuse colorSide when grouping mode matches the coloring mode. This is
  // the common case (group_by unset, falling back to color_by), and
  // skipping the second pass keeps the no-op fast.
  //
  // When expanded we must NOT reuse it even if the modes match: the group side
  // needs every windowed transcript (incl. all-null ones the dataset doesn't
  // measure) so each gets a track — a "(no data)" placeholder for the empties,
  // keeping the page at its full window size. The color side stays as-is so
  // the legend reflects only transcripts that actually have points.
  const groupSide =
    groupMode === colorMode && !isExpanded
      ? colorSide
      : computeDensitySeriesForMode(
          data,
          continuousBins,
          sort_by,
          groupMode,
          isExpanded
        );

  return {
    colorData: colorSide.series,
    groupData: groupSide.series,
    // computeDensitySeriesForMode types unusedKeys as Set<unknown>; narrow at
    // this boundary, matching the `as Set<LegendKey>` casts used on the other
    // unused-key paths in this file. Consumers expect Set<LegendKey>.
    unusedKeys: colorSide.unusedKeys as Set<LegendKey>,
    sortedColorKeys: colorSide.sortedKeys,
    sortedGroupKeys: groupSide.sortedKeys,
  };
}

export function isEveryValueNull(values: any[]) {
  if (!values || values.length === 0) {
    return false;
  }

  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== null) {
      return false;
    }
  }

  return true;
}

export function getRange(values?: number[]) {
  let min = Infinity;
  let max = -Infinity;

  if (values) {
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];

      if (value !== null && value !== undefined) {
        if (value < min) {
          min = value;
        }

        if (value > max) {
          max = value;
        }
      }
    }
  }

  return [min, max];
}

// Given a series of points, spreads out the annotations such that their tails
// don't overlap.
export function calcAnnotationPositions(
  x: number[],
  y: number[],
  pointIndices: number[],
  // Undocumented Plotly property
  fullLayout: {
    xaxis: { l2p: (x: number) => number };
    yaxis: { l2p: (y: number) => number };
  }
) {
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pointIndices.length; i += 1) {
    const px = x[pointIndices[i]] || 0;
    const py = y[pointIndices[i]] || 0;
    sumX += px;
    sumY += py;
    minX = px < minX ? px : minX;
    minY = py < minY ? py : minY;
    maxX = px > maxX ? px : maxX;
    maxY = py > maxY ? py : maxY;
  }

  const avgX = sumX / pointIndices.length;
  const avgY = sumY / pointIndices.length;

  // Get the center of the point cloud in screen coordinates, using an
  // undocumented `l2p` function (linear-to-pixel)
  // https://community.plotly.com/t/how-to-customize-plotly-tooltip/332/13
  const cx = fullLayout.xaxis.l2p(avgX);
  const cy = fullLayout.yaxis.l2p(avgY);

  // Find how wide/tall the selection is on screen.
  const pixelRangeX = Math.abs(
    fullLayout.xaxis.l2p(maxX) - fullLayout.xaxis.l2p(minX)
  );
  const pixelRangeY = Math.abs(
    fullLayout.yaxis.l2p(maxY) - fullLayout.yaxis.l2p(minY)
  );

  if (pointIndices.length === 1 || pixelRangeX > 300) {
    return pointIndices.map((pointIndex) => ({ pointIndex, ax: -20, ay: -30 }));
  }

  if (pixelRangeX === 0 && pixelRangeY !== 0) {
    return pointIndices
      .sort((a, b) => y[b] - y[a])
      .map((pointIndex, i) => ({
        pointIndex,
        ax: 100 * (i % 2 ? -1 : 1),
        ay: Math.min(Math.floor(i / 2) * 10, 100),
      }));
  }

  if (pixelRangeY === 0 && pixelRangeX !== 0) {
    const ax: number[] = [];
    const ay: number[] = [];
    let dx = -pixelRangeX;
    let dy = -100;

    for (let i = 0; i < pointIndices.length; i += 1) {
      ax[i] = dx;
      ay[i] = dy;
      dx += (pixelRangeX * 2) / pointIndices.length;
      dy += 100 / pointIndices.length;
    }

    return pointIndices
      .sort((a, b) => x[a] - x[b])
      .map((pointIndex, i) => ({
        pointIndex,
        ax: ax[i],
        ay: i % 2 ? ay[i] : -ay[pointIndices.length - i - 1],
      }));
  }

  if (pixelRangeY > 300) {
    return pointIndices.map((pointIndex) => ({ pointIndex, ax: 100, ay: 0 }));
  }

  // This radius is used push the annotations out in a circular pattern,
  // centered around the point (cx, cy).
  let radius = Math.max(pixelRangeX, pixelRangeY);
  radius = Math.max(80, radius);
  radius = Math.min(200, radius);

  // We extend the radius in cases where points are packed closely together
  // along the circle.
  const isSmallDifferenceInAngle = (aRads: number, bRads: number) => {
    const delta = Math.abs(aRads - bRads);

    if (pointIndices.length < 7) {
      return delta < 0.6;
    }

    return delta < Math.PI / pointIndices.length;
  };

  let extraRadius = 0;

  return pointIndices
    .map((pointIndex, i) => {
      const px = fullLayout.xaxis.l2p(x[pointIndex]);
      const py = fullLayout.yaxis.l2p(y[pointIndex]);

      // Find angle to the center point
      let rads = Math.atan2(py - cy, px - cx) % (Math.PI * 2);

      // Special case to spread out coincident and colinear points
      if (px === cx || py === cy) {
        rads = ((Math.PI * 4) / pointIndices.length) * i;
      }

      return {
        pointIndex,
        rads,
        py,
        dx: cx - px,
        dy: cy - py,
      };
    })
    .sort((a, b) => a.rads - b.rads)
    .map(({ pointIndex, rads, dx, dy, py }: any, index: number, others) => {
      const other =
        index === 0 ? others[pointIndices.length - 1] : others[index - 1];

      if (isSmallDifferenceInAngle(rads, other.rads)) {
        extraRadius += (extraRadius || radius) ** 0.8;

        if (extraRadius > 150) {
          extraRadius = 0;
        }
      } else {
        extraRadius = 0;
      }

      const ax = Math.cos(rads) * (radius + extraRadius) + dx;
      let ay = Math.sin(rads) * (radius + extraRadius) + dy;

      // Don't let annotations escape off the top of the plot.
      if (py + ay < 0) {
        ay = -py;
      }

      return { pointIndex, ax, ay };
    });
}

// `calcAutoscaleShapes()` is a hack that creates an invisible line. This can
// be used to trick Plotly's autoscaling into forcing the x and y axis scales
// to match.
export function calcAutoscaleShapes(
  showIdentityLine: boolean,
  extents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    ratio: number;
  }
): Layout["shapes"] {
  if (!showIdentityLine || extents.ratio < 0.1) {
    return [];
  }

  const x0 = Math.min(extents.minX, extents.minY);
  const x1 = Math.max(extents.maxX, extents.maxY);
  const y0 = x0;
  const y1 = x1;

  return [
    {
      type: "line",
      xref: "x",
      yref: "y",
      x0,
      x1,
      y0,
      y1,
      line: { color: "transparent" },
    },
  ];
}

export function calcPlotIndicatorLineShapes(
  showIdentityLine: boolean,
  regressionLines: RegressionLine[] | null | undefined,
  extents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    rangeX: number;
    rangeY: number;
  },
  simulateInfiteLength?: boolean,
  // Subplot axis refs the shapes are drawn against. Defaults to the master
  // "x"/"y" pair, so single-panel callers get byte-for-byte identical output.
  // The faceted renderer passes one panel's pair (e.g. "x2"/"y2") to draw the
  // same shapes inside that subplot; endpoints still span the matches-shared
  // extents, so only the refs (and the per-facet slope/intercept) differ.
  axisRefs: { xref: string; yref: string } = { xref: "x", yref: "y" }
) {
  const shapes: Layout["shapes"] = [];
  const xref = axisRefs.xref as XAxisName;
  const yref = axisRefs.yref as YAxisName;
  const extraLength = simulateInfiteLength
    ? Math.max(extents.rangeX, extents.rangeY) * 10
    : 0;

  const p0 =
    extents.minX < extents.minY || !showIdentityLine
      ? extents.minX - extraLength
      : extents.minY - extraLength;

  const p1 =
    extents.maxX > extents.maxY || !showIdentityLine
      ? extents.maxX + extraLength
      : extents.maxY + extraLength;

  if (showIdentityLine) {
    const shape: Layout["shapes"][0] = {
      type: "line",
      xref,
      yref,
      x0: p0,
      x1: p1,
      y0: p0,
      y1: p1,
    };

    const solidLine = { width: 1, color: "#FFFFFF66" };
    const dottedLine = { width: 1, color: "#444", dash: "dot" as const };
    shapes.push({ ...shape, line: solidLine });
    shapes.push({ ...shape, line: dottedLine });
  }

  if (regressionLines) {
    regressionLines.forEach((line) => {
      if (line.hidden) {
        return;
      }

      const shape: Layout["shapes"][0] = {
        layer: "above",
        type: "line",
        xref,
        yref,
        xanchor: 2,
        yanchor: 2,
        x0: p0,
        x1: p1,
        y0: line.m * p0 + line.b,
        y1: line.m * p1 + line.b,
      };

      const contrastLine = { width: 4, color: "ffffff88" };
      const mainLine = { width: 2, color: line.color };
      shapes.unshift({ ...shape, line: contrastLine });
      shapes.push({ ...shape, line: mainLine });
    });
  }

  return shapes;
}

export interface SolidColorGroup {
  color: string;
  // Membership in this color group, by point index. Deliberately ignores point
  // visibility, facet membership, and opposite-axis nulls — those masks belong
  // to the renderer, not to the color semantics.
  includes: (i: number) => boolean;
}

// Pure color-grouping seam shared by the scatter renderers (single-panel and
// small multiples). Given the formatted color inputs, returns the solid-color
// traces to draw, in paint order: index 0 is drawn first (on the bottom), so
// the "other"/largest groups come first and the smallest categories end up on
// top — preserving PrototypeScatterPlot's stacking.
//
// It does NOT handle continuous color: that's a single colorscale trace rather
// than a set of solid groups, so the caller builds it directly. It also
// deliberately omits the legacy ">75 categories -> one trace per color"
// workaround; with faceting that would multiply trace count badly, and high
// color cardinality is already past the readability cliff.
// Orders point indices for a continuous color trace so that bins with the
// fewest *visible* points draw last (on top) and null / "Other" points draw
// first (on the bottom). This is the continuous analogue of the categorical
// "fewest on top" stacking, shared by every renderer that paints continuous
// color so they all stack identically. The returned array is the draw order
// expressed as original point indices (i.e. contTraceIndex): build the trace by
// mapping each per-point array through it, and map a click on the trace's Nth
// point back to result[N]. Counts are visible-only, so hidden points never
// affect the order.
export function orderContinuousPointsByBin(
  contColorData: (number | null)[],
  contLegendKeys: LegendKey[],
  colorMap: Map<LegendKey, string>,
  visible: boolean[]
): number[] {
  const counts = categoricalDataToValueCounts(contLegendKeys, visible);

  // Largest bins first → smaller bins land later in the trace (drawn on top).
  // Keys absent from colorMap (e.g. LEGEND_OTHER for nulls) get index -1 and
  // therefore sort to the very bottom, alongside the separate "other" trace.
  const sortedBins = [...colorMap.keys()]
    .sort((a, b) => {
      const countA = counts.get(a) || 0;
      const countB = counts.get(b) || 0;
      if (countA === countB) {
        return 0;
      }
      return countA < countB ? -1 : 1;
    })
    .reverse();

  return contColorData
    .map((value, origIndex) => ({ value, origIndex }))
    .sort((a, b) => {
      const binIndexA = sortedBins.indexOf(contLegendKeys[a.origIndex]);
      const binIndexB = sortedBins.indexOf(contLegendKeys[b.origIndex]);

      if (binIndexA !== binIndexB) {
        return binIndexA - binIndexB;
      }

      if (a.value === b.value || a.value == null || b.value == null) {
        return 0;
      }

      return a.value < b.value ? -1 : 1;
    })
    .map(({ origIndex }) => origIndex);
}

export function getSolidColorGroups(args: {
  color1: (boolean | null)[] | null;
  color2: (boolean | null)[] | null;
  catColorData: (string | number | null)[] | null;
  colorMap: Map<LegendKey, string>;
  palette: DataExplorerColorPalette;
  visible: boolean[];
}): SolidColorGroup[] {
  const { color1, color2, catColorData, colorMap, palette, visible } = args;

  // Comparison mode: two boolean masks plus their overlap, with an "other"
  // catch-all for points in neither.
  if (color1 || color2) {
    const groups: (SolidColorGroup & { count: number })[] = [];

    if (color1) {
      groups.push({
        color: palette.compare1,
        includes: (i) => Boolean(color1?.[i]) && !color2?.[i],
        count: countExclusivelyTrueValues(color1, color2, visible),
      });
    }
    if (color2) {
      groups.push({
        color: palette.compare2,
        includes: (i) => Boolean(color2?.[i]) && !color1?.[i],
        count: countExclusivelyTrueValues(color2, color1, visible),
      });
    }
    if (color1 && color2) {
      groups.push({
        color: palette.compareBoth,
        includes: (i) => Boolean(color1?.[i]) && Boolean(color2?.[i]),
        count: countInclusivelyTrueValues(color1, color2, visible),
      });
    }

    // Larger groups on the bottom (drawn first), smaller on top.
    groups.sort((a, b) => (a.count < b.count ? 1 : -1));

    return [
      { color: palette.other, includes: (i) => !color1?.[i] && !color2?.[i] },
      ...groups.map(({ color, includes }) => ({ color, includes })),
    ];
  }

  // Categorical mode: one group per category value that has visible points,
  // plus "other" for nulls.
  if (catColorData) {
    const counts = categoricalDataToValueCounts(
      catColorData.map((v) => (v == null ? null : String(v))),
      visible
    );

    const groups: SolidColorGroup[] = [...colorMap.keys()]
      .filter((key): key is string => typeof key === "string")
      .map((key) => ({ key, count: counts.get(key) || 0 }))
      // Drop categories with no visible points; otherwise faceting multiplies
      // empty traces by the facet count.
      .filter(({ count }) => count > 0)
      .sort((a, b) => (a.count < b.count ? 1 : -1))
      .map(({ key }) => ({
        color: colorMap.get(key)!,
        includes: (i: number) => String(catColorData[i]) === key,
      }));

    return [
      { color: palette.other, includes: (i) => catColorData[i] == null },
      ...groups,
    ];
  }

  // No color enabled: one group covering every point.
  return [{ color: palette.all, includes: () => true }];
}
