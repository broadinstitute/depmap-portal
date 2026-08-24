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
import {
  HARD_MAX_CATEGORIES,
  SOFT_MAX_CATEGORIES,
} from "../../../../../constants/plotConstants";
import {
  scoreCategories,
  selectBestCategories,
} from "../../../../../utils/bestCategories";
import { compareNaturally } from "@depmap/utils";

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
// LEGEND_OTHER means "missing data" — a null categorical/continuous value —
// and always displays as "N/A" (see categoryToDisplayName). LEGEND_NEITHER
// is the distinct "real, explicit classification" case: a point in neither
// of two selected raw_slice/aggregated_slice contexts, which always
// displays as "Other". The two used to share one symbol, which forced
// categoryToDisplayName to guess which display text applied via a fragile
// heuristic (checking whether continuousBins happened to be set, or
// scanning the categorical data for a literal "Other" string) — separate
// identities make the correct text a certainty, not a guess, everywhere.
export const LEGEND_OTHER = Symbol("Other");
export const LEGEND_NEITHER = Symbol("Neither");
// A third, distinct meaning: real categories with real data that didn't earn
// their own color, collapsed together. Not LEGEND_OTHER (which means "no
// value") and not LEGEND_NEITHER (which means "in neither selected context").
// Kept separate for the same reason those two are — so display text is a
// certainty rather than a guess — and because a grey point must not be
// ambiguous between "missing" and "not highlighted".
export const LEGEND_REMAINDER = Symbol("Remainder");
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
  | typeof LEGEND_NEITHER
  | typeof LEGEND_REMAINDER
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

// Deliberately NOT palette.other (or palette.all): this fills/colors a
// track/point when facet_by has real backing but color_by has nothing of
// its own to represent it (e.g. color_by absent/"uniform", or diverged from
// facet_by — see PrototypeDensity1D's colorMatchesFacet). That's a "this
// axis isn't part of the color scheme" treatment, not a color_by category —
// palette.all/palette.other are user-editable, and letting a user's palette
// customization tint this would incorrectly read as if it were still
// semantically part of color_by. A fixed neutral gray keeps it inert
// regardless of palette customization.
export const NEUTRAL_FACET_FILL = "#bdbdbd";

// Deliberately darker than palette.other, which paints missing data. The two
// buckets can appear in one legend, and a reader has to be able to tell "this
// point has no value" from "this point's category wasn't one of the ones shown".
export const REMAINDER_FILL = "#8a8a8a";

// The facet panel that collapsed categories share. A plain string, because
// facetKeys are strings throughout (the null facet is likewise the literal
// "N/A"); facetColorKeys translates it back to LEGEND_REMAINDER for anything
// doing a color or visibility lookup.
export const REMAINDER_FACET = "Other categories";

const compareLegendKeys = (keyA: symbol | string, keyB: symbol | string) => {
  if (typeof keyA === "symbol") {
    return 1;
  }

  if (typeof keyB === "symbol") {
    return -1;
  }

  return compareNaturally(keyA, keyB);
};

export const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) {
    throw new Error(`hexToRgba(): a hex string like "#00AAFF" must be passed.`);
  }

  const [r, g, b] = hex
    .replace(/^#/, "")
    .replace(/(.)/g, hex.length < 6 ? "$1$1" : "$1")
    .match(/../g)!
    .map((word) => parseInt(word, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function nullifyUnplottableValues(
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
// the caller is using it for the faceting seam, track assignment). When
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
// own concerns (the renderer composes a color-facet selector on top; the fit
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

// Derives facet_by's per-point facet identity, for any renderer that needs
// to split a plot into one panel/fit per facet — small multiples
// (DataExplorerScatterPlot) and the per-facet regression fit/table below
// both need the SAME facet labels, since the table/lines are looked up by
// label string against the panels the renderer already drew.
//
// Categorical: facetKeys from the facet triad's categorical/text source,
// null values mapped to the literal "N/A" string (a real, visible
// facet — facet_by has no data for those points, but they still get a
// panel). facetOrder IS explicit here too: alphabetical (natural,
// case-insensitive, via compareLegendKeys), with "N/A" moved last —
// giving every caller (scatter's small-multiples panel grid, the regression
// table) the same sensible default order instead of each falling back to
// its own convention.
//
// Continuous: facet's own property may not be categorical at all (e.g. a
// numeric annotation) — bin it independently of any continuous color
// binning (a facet key is just display text here, so the bin's formatted
// range string doubles as both the key and the panel title). facetOrder IS
// explicit here (natural ascending bin order) since there's no sensible
// generic sort for formatted range strings otherwise.
export function computeFacets(
  data: DataExplorerPlotResponse | null,
  mode: DataExplorerPlotConfig["facet_by"],
  // Which triad `mode` resolves against. Defaults to "facet" (this
  // function's original, and still primary, purpose); the regression
  // fallback (see Addendum 5 / regressionLines) also calls this with
  // target "color" to facet by color_by's own triad when facet_by is
  // unset — the internals below don't care which triad they're reading,
  // they just read whichever `target` names.
  target: "color" | "facet" = "facet",
  chosen?: string[] | null
): {
  facetKeys: string[];
  facetOrder?: string[];
  // Maps a formatted facet string back to the original LegendKey it came
  // from, for facets whose real colorMap identity is a shared Symbol
  // (LEGEND_RANGE_N / LEGEND_BOTH / LEGEND_OTHER) that got stringified above
  // for facetMaskFor's string-keyed matching and panel titles. A caller that
  // needs to look a facet's color up in colorMap (keyed by those Symbols,
  // never by the formatted text) must go through this map first — looking
  // up the formatted string directly always misses. The categorical branch's
  // real category-value facetKeys are already valid colorMap keys as-is and
  // need no entry; its one exception is "N/A" (LEGEND_OTHER),
  // included below for the same reason the other branches are.
  facetColorKeys?: Record<string, LegendKey>;
} | null {
  if (!data || !mode) {
    return null;
  }

  const catSlice = findCategoricalSlice(data, mode, target);
  if (catSlice) {
    // Facets are capped for the same reason colors are, and by the same
    // ranking — a panel per category stops being readable well before the
    // categories run out, and `ceil(sqrt(F))` will happily lay out a hundred of
    // them. The collapsed ones share one panel rather than disappearing.
    //
    // This has to agree with computeDensitySeriesForMode, which resolves the
    // same points through the same function. When it didn't, the series put a
    // point in the remainder while the order still listed its category, and the
    // panel rendered as empty space.
    const { shown, hasRemainder } = getShownCategories(
      catSlice.values as string[],
      data.dimensions,
      data.filters,
      SOFT_MAX_CATEGORIES,
      chosen
    );

    const facetKeys: string[] = catSlice.values.map((v) => {
      if (v == null) {
        return "N/A";
      }

      const category = String(v);

      return hasRemainder && !shown.has(category) ? REMAINDER_FACET : category;
    });

    // facetOrder: alphabetical (natural, case-insensitive — same collator
    // sortLegendKeys/sortLegendKeysWaterfall use for density/waterfall's own
    // "alphabetical" sort_by), with "N/A" moved last when present.
    // Without this, callers with no other convention of their own (the
    // scatter small-multiples panel grid) fell back to first-seen order over
    // the response's per-point array — whatever order the backend happened
    // to return points in, which reads as arbitrary/strange to users.
    // compareLegendKeys' symbol-last rule doesn't help here on its own:
    // "N/A" is a plain string at this point, not the LEGEND_OTHER
    // symbol itself, so it needs the same explicit append-last handling the
    // continuous branch below already uses for its own null facet.
    const hasNullFacet = facetKeys.includes("N/A");
    const hasRemainderFacet = facetKeys.includes(REMAINDER_FACET);

    const realNames = [...new Set(facetKeys)].filter(
      (k) => k !== "N/A" && k !== REMAINDER_FACET
    );

    return {
      facetKeys,
      // The two catch-alls go last, in the same order the legend puts them:
      // the collapsed categories, then the ones with no value at all.
      facetOrder: [
        ...realNames.sort(compareLegendKeys),
        ...(hasRemainderFacet ? [REMAINDER_FACET] : []),
        ...(hasNullFacet ? ["N/A"] : []),
      ],
      // "N/A" stringifies the same LEGEND_OTHER identity the color
      // side uses for a null categorical value (see e.g.
      // computeDensitySeriesForMode's `x === null ? LEGEND_OTHER : x`) — a
      // caller doing a colorMap/hiddenLegendValues lookup by the formatted
      // string must translate back through here first, same as the
      // continuous/custom-filter branches below.
      facetColorKeys: {
        "N/A": LEGEND_OTHER,
        // Only when there is one. This table describes the facets actually
        // present, and a caller translating a name it never saw would be
        // looking up something that isn't on the plot.
        ...(hasRemainderFacet ? { [REMAINDER_FACET]: LEGEND_REMAINDER } : {}),
      },
    };
  }

  const contSlice = findContinuousColorSlice(data, target);
  if (contSlice) {
    const bins = calcBins(contSlice.values);
    const binned = computeContinuousLegendKeySeries(contSlice.values, bins);

    if (binned) {
      const labelFor = (key: LegendKey) =>
        key === LEGEND_OTHER
          ? "N/A"
          : formatCategoryLabel(key, data, bins, target);

      // binned.sortedKeys already appends LEGEND_OTHER itself (see
      // computeContinuousLegendKeySeries) whenever at least one point
      // actually resolved to it — no need to re-derive that here.
      const orderedKeys: LegendKey[] = binned.sortedKeys;

      const facetOrder = orderedKeys.map(labelFor);
      const facetColorKeys: Record<string, LegendKey> = {};
      orderedKeys.forEach((key, i) => {
        facetColorKeys[facetOrder[i]] = key;
      });

      return {
        facetKeys: binned.series.map(labelFor),
        facetOrder,
        facetColorKeys,
      };
    }
  }

  // Custom-filter fallback: "raw_slice"/"aggregated_slice" backed by
  // filters.[target]1/[target]2, mirroring the other axis's own
  // custom-filter partition (see computeCustomFilterSeries) — a real facet
  // per selected context, an automatic "Other" facet for points in neither,
  // and a "Both" facet for the overlap. Like the categorical/continuous
  // "N/A" sentinel, none of these are excluded from
  // computeFacetedLinReg's fitted rows — every facet gets a fit.
  const filter1 = data.filters?.[`${target}1`];
  const filter2 = data.filters?.[`${target}2`];
  if (filter1 || filter2) {
    const custom = computeCustomFilterSeries(
      filter1,
      filter2,
      data.filters?.visible
    );
    const labelFor = (key: string | symbol) =>
      typeof key === "string"
        ? key
        : formatCategoryLabel(key as LegendKey, data, null, target);

    const facetOrder = custom.sortedKeys.map(labelFor);
    const facetColorKeys: Record<string, LegendKey> = {};
    custom.sortedKeys.forEach((key, i) => {
      // Only the LEGEND_BOTH/LEGEND_NEITHER symbols need translating back —
      // filter1.name/filter2.name are already plain strings and valid
      // colorMap keys as-is, so mapping them here would be redundant.
      if (typeof key !== "string") {
        facetColorKeys[facetOrder[i]] = key as LegendKey;
      }
    });

    return {
      facetKeys: custom.series.map(labelFor),
      facetOrder,
      facetColorKeys,
    };
  }

  return null;
}

// Per-facet linear-regression stats (the LinRegInfo[] shape the regression
// table consumes), faceted by facet_by, computed from a materialized response.
// The table's faceted counterpart to fetchLinearRegression's color-faceted fit
// — same row shape, so reformatLinRegTable handles either. It lives here (not
// in the services layer) because faceting needs computeFacets, which is
// a component-layer concern; the table fetches `data` and calls this.
//
// It shares the facet-membership predicate (facetMaskFor) and the fit
// (linregress) with the drawn per-facet lines, so the two agree on
// slope/intercept given the same inputs. The lines fit over the hook's
// nulled/legend-visible arrays while this fits over the raw response with
// filter-visibility — the same lines-vs-table divergence the single-panel path
// already has via fetchLinearRegression; faceting (the J2 requirement) matches.
export function computeFacetedLinReg(
  data: DataExplorerPlotResponse,
  mode: ColorByValue,
  visible?: boolean[],
  // Appended last (not inserted before `visible`) so no existing positional
  // call site shifts meaning. Defaults to "facet" — this function's
  // original purpose; the regression fallback (Addendum 5) also calls this
  // with target "color" to fit color_by's own facets when facet_by is unset.
  target: "color" | "facet" = "facet",
  // Must match how the renderer facets, or the per-facet fits are keyed to
  // panels that don't exist.
  chosen?: string[] | null
): LinRegInfo[] {
  const facetInfo = computeFacets(data, mode, target, chosen);
  const xs = data.dimensions?.x?.values;
  const ys = data.dimensions?.y?.values;

  if (!facetInfo || !xs || !ys) {
    return [];
  }

  const { facetKeys, facetOrder } = facetInfo;
  const vis = visible || xs.map(() => true);

  // The "N/A" bucket gets a fit too, same as any other facet — its
  // points are genuinely plottable (only the faceting annotation is
  // missing), and users found its absence more confusing than a technically
  // arguable line. facetOrder is always set by every current
  // computeFacets branch, so this `??` fallback is defensive dead code
  // today — kept (using the same natural/case-insensitive comparator as
  // every other alphabetical sort in this file, not a bare `.sort()`) in
  // case a future branch forgets to set facetOrder.
  const facets = facetOrder ?? [...new Set(facetKeys)].sort(compareLegendKeys);

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
// has no facet_by. It mirrors the single pooled line the plot draws and,
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

// `target` picks which triad this call reads: "color" is dimensions.color +
// metadata.color_property (backed by filters.color1/color2 upstream), "facet"
// is the parallel dimensions.facet + metadata.facet_property (backed by
// filters.facet1/facet2). "expansion" is target-agnostic — it never reads
// either triad, since it's backed by `expand_by`/`data.expansions`, not by a
// dimension/filter/metadata selection.
export function findCategoricalSlice(
  data: DataExplorerPlotResponse | null,
  mode?: ColorByValue,
  target: "color" | "facet" = "color"
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

  const dim =
    target === "facet" ? data.dimensions?.facet : data.dimensions?.color;

  if (dim && ["text", "categorical"].includes(dim.value_type)) {
    return {
      label: dim.axis_label,
      dataset_id: dim.dataset_id,
      values: dim.values.map((v) => v?.toString() || null),
      value_type: dim.value_type,
    };
  }

  const property =
    target === "facet"
      ? data?.metadata?.facet_property
      : data?.metadata?.color_property;

  if (property && ["text", "categorical"].includes(property.value_type)) {
    return {
      label: property.label,
      dataset_id: property.sliceQuery?.dataset_id,
      values: property.values.map((v) => v?.toString() || null),
      value_type: property.value_type,
    };
  }

  return null;
}

export function findContinuousColorSlice(
  data: DataExplorerPlotResponse | null,
  target: "color" | "facet" = "color"
) {
  const dim =
    target === "facet" ? data?.dimensions?.facet : data?.dimensions?.color;

  if (dim?.value_type === "continuous") {
    return {
      label: dim.axis_label,
      dataset_id: dim.dataset_id,
      values: dim.values,
      value_type: dim.value_type,
    };
  }

  const property =
    target === "facet"
      ? data?.metadata?.facet_property
      : data?.metadata?.color_property;

  if (property?.value_type === "continuous") {
    return {
      label: property.label,
      dataset_id: property.sliceQuery?.dataset_id,
      values: property.values as number[],
      value_type: property.value_type,
    };
  }

  return null;
}

// Resolves what `color_by` actually means at render time, folding in the
// version-2 default flip (ADR 0001, ADR 0004) and the "uniform" opt-out
// sentinel. Every call site that reads `plotConfig.color_by` directly (as
// either a `mode` for findCategoricalSlice-shaped helpers, or to pick
// `target: "color"`) must instead call this once and use its `{mode,
// target}` pair.
//
// Centralizing this is what makes the "facet: null degenerate" (ADR 0001's
// phrase for "what if color_by resolves to facet but facet_by itself has
// no backing?") resolve for free: when `effective === "facet"`, `mode`
// becomes `plotConfig.facet_by` itself — which may be undefined or an
// incomplete-but-present value — and every target-aware helper's existing
// "no categorical/continuous/custom match" fallthrough already treats that
// as uniform, the exact same path that already runs today whenever
// `facet_by` is literally unset for the facet-SIDE computations. No new
// degenerate-case branch is needed anywhere, as long as every call site
// uses this resolver's output instead of re-deriving its own.
//
// Must only ever be called against an already-migrated (in-memory) plot
// config, never a raw wire payload — readPlotFromQueryString's Phase B
// migration is what makes a version-1 payload's absent color_by arrive
// here as explicit "uniform" rather than falling through to "facet".
export function resolveColorMode(
  plotConfig: Pick<DataExplorerPlotConfig, "color_by" | "facet_by">
): { mode: ColorByValue | undefined; target: "color" | "facet" } {
  const effective = plotConfig.color_by ?? "facet";

  if (effective === "uniform") {
    // Explicit opt-out. mode: undefined (not "uniform") + target: "color"
    // makes every helper's "no color source found" fallback fire, which is
    // exactly uniform — and is robust to stale dimensions.color/
    // metadata.color_property data surviving on the plot independent of
    // normalizePlot's own guards against that (defense in depth for a
    // sentinel that must never silently reappear as colored).
    return { mode: undefined, target: "color" };
  }

  if (effective === "facet") {
    return { mode: plotConfig.facet_by, target: "facet" };
  }

  return { mode: effective, target: "color" };
}

export function formatDataForScatterPlot(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"],
  target: "color" | "facet" = "color",
  // Which axis's label should carry the "filtered by"/"faceted by" suffix.
  // Defaults to "x" — true for scatter/density, where x is always the real
  // measured dimension. Waterfall calls this with "y": its response remaps
  // the real measured dimension onto y and gives x a synthetic "rank" label
  // (see fetchWaterfall's HACK comment in breadboxMethods.ts), so the
  // suffix belongs on y there, not on whatever "Rank"/"" happens to be on x.
  extrasAxis: "x" | "y" = "x"
) {
  if (!data) {
    return null;
  }

  const round = (num: number) =>
    Math.round((num + Number.EPSILON) * 1.0e7) / 1.0e7;

  const c1Values = data.filters?.[`${target}1`]?.values;
  const c2Values = data.filters?.[`${target}2`]?.values;
  const catValues = findCategoricalSlice(data, color_by, target)?.values;
  const contSlice = findContinuousColorSlice(data, target);
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

  // facet_by's own display name (custom dimension or property) — only ever
  // populated here when facet_by actually has that kind of backing, which
  // (per computeFacets/isFaceted in DataExplorerScatterPlot.tsx) is exactly
  // when this plot is rendered as small multiples. Mirrors PlotFacets.tsx's
  // FacetSliceDescription; raw_slice/aggregated_slice (filters.facet1/2) has
  // no single name to show here, same as "filtered by" never covering
  // filters.color1/2 either.
  const facetName =
    data.dimensions?.facet?.axis_label ?? data.metadata?.facet_property?.label;

  const extras: string[] = [];
  if (data.filters.visible) {
    extras.push(`filtered by ${data.filters.visible.name}`);
  }
  if (facetName) {
    extras.push(`faceted by ${facetName}`);
  }

  if (extras.length > 0) {
    const suffix = `<br>${extras.join(", ")}`;
    if (extrasAxis === "y" && yLabel) {
      yLabel += suffix;
    } else if (xLabel) {
      xLabel += suffix;
    } else {
      yLabel += suffix;
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
        colorInfo.push(data.filters[`${target}1`]!.name);
      }

      if (c2Values && c2Values[i] && color_by === "aggregated_slice") {
        colorInfo.push(data.filters[`${target}2`]!.name);
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

// Waterfall's x-positions are reassigned to cluster bars by facet. Today
// that clustering uses `formatted.catColorData` (the color-side categorical),
// because color and facet were conflated. With the split, the clustering
// uses `facetData` when supplied, falling back to `catColorData` for the
// converged case. Similarly `sortedFacetKeys` replaces the historical
// `sortedLegendKeys` parameter — its meaning was always "the order of
// clusters along x" rather than "the legend display order."
export function formatDataForWaterfall(
  data: DataExplorerPlotResponse | null,
  color_by: DataExplorerPlotConfig["color_by"],
  sortedFacetKeys?: (string | symbol)[],
  // Symbols allowed, matching sortedFacetKeys above and what the bucketing
  // below already does (`Record<string | symbol, …>` keyed via Reflect.ownKeys).
  // The color side spells its remainder as a symbol, so clustering by the
  // collapsed color partition needs this to be as wide as the implementation
  // always was.
  facetData?: (string | symbol | null)[] | null,
  target: "color" | "facet" = "color"
) {
  if (!data) {
    return null;
  }

  // "y" — waterfall's response remaps the real measured dimension onto y and
  // gives x a synthetic "rank" label (see the HACK comment on this response
  // shape in breadboxMethods.ts's fetchWaterfall), so the "filtered by"/
  // "faceted by" suffix belongs on y here, not on whatever happens to be on x.
  const formatted = formatDataForScatterPlot(data, color_by, target, "y");

  if (!formatted || !sortedFacetKeys) {
    return formatted;
  }

  // Clustering source: prefer the explicit facetData (facet-side categorical)
  // when supplied; otherwise reuse the color-side catColorData, matching
  // pre-split behavior.
  const clusterBy = (facetData ?? formatted.catColorData) as
    | (string | symbol | null)[]
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
    // `Object.values`/`Object.keys` never see Symbol-keyed properties — and
    // a continuous facet_by (or the LEGEND_OTHER null bucket) keys `buckets`
    // with LEGEND_RANGE_* symbols, not strings. `Object.values(buckets)`
    // would silently iterate zero buckets in that case, leaving every
    // symbol-keyed cluster's indices in raw materialization order — no
    // ascending "snake" within the cluster, just whatever order the points
    // happened to arrive in (a scattered, Manhattan-plot-like look, not a
    // smooth ramp). `Reflect.ownKeys` sees both string and symbol keys.
    Reflect.ownKeys(buckets).forEach((key) => {
      buckets[key].sort((a, b) => {
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
  const minLength = domain / sortedFacetKeys.length;

  sortedFacetKeys.forEach((key) => {
    const indices = buckets[key];

    // A category in sortedFacetKeys with no points in `clusterBy` is
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
  mb?: DataExplorerMetadata,
  target: "color" | "facet" = "color"
) {
  const a = ma?.[`${target}_property`];
  const b = mb?.[`${target}_property`];

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
  legendKeysWithNoData?: any,
  // When provided, pins this hook instance to one specific triad instead of
  // deferring to resolveColorMode — needed for a second, independent
  // instance driving the Facets panel (always "facet", regardless of what
  // color_by resolves to). Omitted (the default), this preserves today's
  // exact behavior for the color legend's own instance.
  targetOverride?: "color" | "facet"
) {
  const prevPlotConfig = useRef(plotConfig);
  const recentClickKey = useRef<string | symbol | null>(null);
  const recentClickMap = useRef<Record<string, string> | null>(null);
  const [hiddenLegendValues, setHiddenLegendValues] = useState(() => new Set());

  useEffect(() => {
    let hasChanges = false;

    // Resolved once per render and used for BOTH the previous and current
    // plotConfig — color_by/facet_by could themselves have changed between
    // renders (changing what target resolves to), so this must compare
    // apples to apples: "did whatever backs the CURRENTLY-effective axis
    // change," not two different axes for old vs. new. A caller pinning this
    // instance to "facet" (see targetOverride above) always compares against
    // facet_by's own triad instead, independent of color_by.
    const target = targetOverride ?? resolveColorMode(plotConfig).target;

    if (
      colorMetadataChanged(
        prevPlotConfig.current.metadata,
        plotConfig.metadata,
        target
      )
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.[`${target}1`]?.name !==
      plotConfig.filters?.[`${target}1`]?.name
    ) {
      hasChanges = true;
    }

    if (
      prevPlotConfig.current.filters?.[`${target}2`]?.name !==
      plotConfig.filters?.[`${target}2`]?.name
    ) {
      hasChanges = true;
    }

    if (
      Boolean(prevPlotConfig.current.dimensions[target]?.context) !==
      Boolean(plotConfig.dimensions[target]?.context)
    ) {
      hasChanges = true;
    }

    if (hasChanges) {
      setHiddenLegendValues(new Set());
    }

    prevPlotConfig.current = plotConfig;
  }, [plotConfig, targetOverride]);

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
  color_by?: ColorByValue,
  target: "color" | "facet" = "color",
  chosen?: string[] | null
) {
  if (!data) {
    return null;
  }

  if (hide_points || hiddenLegendValues.has(LEGEND_ALL)) {
    return data.dimensions.x.values.map(() => false);
  }

  const contKeys = Reflect.ownKeys(continuousBins || {});
  const contValues = findContinuousColorSlice(data, target)?.values;

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

  const catValues = findCategoricalSlice(data, color_by, target)?.values;

  if (catValues) {
    // Through the resolver rather than against the raw value: a collapsed
    // category is no longer a legend row of its own, so `hiddenLegendValues`
    // will never contain it and testing it directly leaves those points
    // permanently visible while the bucket's own toggle moves nothing.
    const toLegendKey = makeLegendKeyResolver(
      getShownCategories(
        catValues as string[],
        (data.dimensions as unknown) as Record<string, { values: unknown[] }>,
        (data.filters as unknown) as Record<string, { values: boolean[] }>,
        SOFT_MAX_CATEGORIES,
        chosen
      )
    );

    return catValues.map(
      (value) => !hiddenLegendValues.has(toLegendKey(value))
    );
  }

  const c1Values = data.filters?.[`${target}1`]?.values;
  const c2Values = data.filters?.[`${target}2`]?.values;
  const visiblePoints = data.dimensions.x.values.map(() => true);

  if (c1Values && hiddenLegendValues.has(data.filters[`${target}1`]!.name)) {
    c1Values.forEach((value: boolean, i: number) => {
      if (value && !(c2Values || [])[i]) {
        visiblePoints[i] = false;
      }
    });
  }

  if (c2Values && hiddenLegendValues.has(data.filters[`${target}2`]!.name)) {
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

  if (hiddenLegendValues.has(LEGEND_NEITHER)) {
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

// How many points the plot would actually draw. "Would draw" is the same rule
// the legend uses to gray out a category with nothing behind it: visible, and
// non-null on every axis in play. Factored out so the two can't drift — a plot
// reporting itself empty while the legend still lists live categories, or the
// reverse, would be worse than either answer alone.
//
// Returns null when there is nothing to judge by, which is not the same as
// zero. A correlation heatmap has no per-point x/y arrays at all, and a plot
// mid-configuration may have no x dimension yet; neither is an empty result.
export function countPlottablePoints(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): number | null {
  const xValues = data?.dimensions?.x?.values;

  if (!xValues) {
    return null;
  }

  const yValues = data?.dimensions?.y?.values;
  const visible = data?.filters?.visible;
  let count = 0;

  for (let i = 0; i < xValues.length; i += 1) {
    if (
      (!visible || visible.values[i]) &&
      xValues[i] !== null &&
      (!yValues || yValues[i] !== null)
    ) {
      count += 1;
    }
  }

  return count;
}

export function getLegendKeysWithNoData(
  data: any,
  continuousBins: any,
  color_by?: ColorByValue,
  target: "color" | "facet" = "color"
) {
  const catData = findCategoricalSlice(data, color_by, target);
  const visible = data?.filters?.visible;

  if (catData) {
    // "No data" means no point that is both visible AND plottable — a point
    // null on x (or on y, when a y dimension exists) plots nowhere, so a
    // category made up entirely of such points has nothing to show (e.g. an
    // expansion member the dataset doesn't measure). A missing `visible`
    // filter means every point is visible; it must not disable this
    // bookkeeping (it used to gate the whole computation).
    const xValues = data?.dimensions?.x?.values;
    const yValues = data?.dimensions?.y?.values;
    const counts: Record<string, number> = {};
    const unusedKeys = new Set();

    for (let i = 0; i < catData.values.length; i += 1) {
      const category = catData.values[i];

      if (category) {
        counts[category] = counts[category] || 0;
        counts[category] +=
          (!visible || visible.values[i]) &&
          (!xValues || xValues[i] !== null) &&
          (!yValues || yValues[i] !== null)
            ? 1
            : 0;
      }
    }

    Object.keys(counts).forEach((category) => {
      if (counts[category] === 0) {
        unusedKeys.add(category);
      }
    });

    return unusedKeys as Set<LegendKey>;
  }

  const contData = findContinuousColorSlice(data, target);

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
  visible: boolean[],
  target: "color" | "facet" = "color"
) => {
  if (!values) {
    return false;
  }

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];

    if (value === null) {
      const dimensionsAreNotNull = Object.keys(dimensions || {})
        .filter((key) => key !== target)
        .every((key) => dimensions![key].values[i] !== null);

      if (dimensionsAreNotNull && visible[i]) {
        return true;
      }
    }
  }

  return false;
};

// Which categories get to be themselves, and whether anything was collapsed.
//
// This is the single answer to that question. It used to be computed inside the
// color map and nowhere else, which was wrong: the color map is one of four
// places that turn a point's category into a legend key — visibility toggling,
// the density/waterfall series, and the no-data bookkeeping are the others —
// and each of them independently assumed every category *is* a key. That held
// until categories started being collapsed, and then each one broke in its own
// way: blank legend rows, a toggle that moved nothing, phantom density curves.
//
// Derived from the data rather than from the color map on purpose. The density
// path builds its series first and hands the resulting order to the color map,
// so a consumer that asked the color map would be asking something that does
// not exist yet.
// Which of the two override lists governs a partition. Keyed off the RESOLVED
// target, never the raw config field: when `color_by` defers to `facet_by`
// there is one partition, resolved as target "facet", and `facet_categories` is
// what governs it. Going through here is what stops the two lists disagreeing
// about a partition they share.
export function chosenCategoriesFor(
  plotConfig:
    | Pick<DataExplorerPlotConfig, "color_categories" | "facet_categories">
    | null
    | undefined,
  target: "color" | "facet"
): string[] | undefined {
  return target === "facet"
    ? plotConfig?.facet_categories
    : plotConfig?.color_categories;
}

export function getShownCategories(
  values: string[] | null,
  dimensions: Record<string, { values: unknown[] }> | null,
  filters: Record<string, { values: boolean[] }> | null,
  cap: number = SOFT_MAX_CATEGORIES,
  // The user's own choice, from the category picker. Overrides the ranking
  // entirely — that is what makes it a choice rather than a suggestion.
  chosen?: string[] | null
): { shown: Set<string>; hasRemainder: boolean } {
  if (!values) {
    return { shown: new Set(), hasRemainder: false };
  }

  const visible = filters?.visible?.values || Array(values.length).fill(true);
  const counts = categoricalDataToValueCounts(values, visible);

  const plottableCategories = findPlottableCategories(
    values,
    dimensions,
    visible
  );

  const allKeys = ([...counts.keys()].filter(Boolean) as string[]).filter(
    (key) => counts.get(key)! > 0 && plottableCategories.has(key)
  );

  if (chosen && chosen.length > 0) {
    // Intersected with what the data actually has rather than trusted outright,
    // so a config naming categories this annotation no longer contains can't
    // ask for something that isn't there. Capped for the same reason a ranked
    // set is: deliberateness doesn't make a hundred swatches legible.
    const wanted = new Set(chosen);
    const kept = allKeys
      .filter((key) => wanted.has(key))
      .slice(0, HARD_MAX_CATEGORIES);

    // Nothing survived — the choice is entirely stale, so choosing is better
    // than showing an empty plot.
    if (kept.length > 0) {
      return {
        shown: new Set(kept),
        hasRemainder: kept.length < allKeys.length,
      };
    }
  }

  if (allKeys.length <= cap) {
    return { shown: new Set(allKeys), hasRemainder: false };
  }

  const axes = [dimensions?.x, dimensions?.y]
    .filter(Boolean)
    .map((dim) => dim!.values)
    // A categorical or otherwise non-numeric axis has no position to be
    // separated along, so it contributes nothing to the score.
    .filter((vals) => vals.some((v) => typeof v === "number")) as (
    | number
    | null
  )[][];

  const kept = selectBestCategories(
    scoreCategories(values, axes, visible),
    cap,
    compareNaturally
  );

  return { shown: new Set(kept), hasRemainder: kept.length < allKeys.length };
}

// Maps one point's raw category value to the legend key that represents it.
// Null becomes N/A; a collapsed category becomes the remainder bucket.
export function makeLegendKeyResolver(shownCategories: {
  shown: Set<string>;
  hasRemainder: boolean;
}) {
  const { shown, hasRemainder } = shownCategories;

  return (value: unknown): LegendKey => {
    if (value === null || value === undefined || value === "") {
      return LEGEND_OTHER;
    }

    const category = String(value);

    if (shown.has(category) || !hasRemainder) {
      return category;
    }

    return LEGEND_REMAINDER;
  };
}

// Collapses a categorical series and its key order together, so the points and
// the list of things that represent them can never disagree.
//
// Both halves matter and they are easy to fix one at a time: collapsing only
// the series leaves the Facets panel offering rows the plot has merged away;
// collapsing only the order leaves points stranded in a panel with nothing in
// it. Every categorical color/facet path should go through here.
export function collapseCategoricalSeries<K extends LegendKey = LegendKey>(
  values: (string | null)[],
  dimensions: Record<string, { values: unknown[] }> | null,
  filters: Record<string, { values: boolean[] }> | null,
  rawSortedKeys: LegendKey[] | undefined,
  chosen?: string[] | null,
  // How the bucket is spelled. The color side keys legends by symbol; the
  // facet side keys panels by string, exactly as it does for null ("N/A" rather
  // than LEGEND_OTHER). Callers pass whichever their pipeline is built from.
  remainderKey: LegendKey = LEGEND_REMAINDER
): { series: K[]; sortedKeys: K[] | undefined } {
  const resolve = makeLegendKeyResolver(
    getShownCategories(
      values as string[],
      dimensions,
      filters,
      SOFT_MAX_CATEGORIES,
      chosen
    )
  );

  const toLegendKey = (value: unknown) => {
    const key = resolve(value);
    return key === LEGEND_REMAINDER ? remainderKey : key;
  };

  const series = values.map(toLegendKey) as K[];

  if (!rawSortedKeys) {
    return { series, sortedKeys: rawSortedKeys };
  }

  const seen = new Set<LegendKey>();
  const sortedKeys: LegendKey[] = [];
  let sawRemainder = false;

  rawSortedKeys.forEach((key) => {
    const resolved = typeof key === "string" ? toLegendKey(key) : key;

    if (resolved === remainderKey) {
      sawRemainder = true;
      return;
    }

    if (!seen.has(resolved)) {
      seen.add(resolved);
      sortedKeys.push(resolved);
    }
  });

  if (sawRemainder) {
    // Just before N/A, matching computeFacets' order and the legend's.
    const naIndex = sortedKeys.indexOf(LEGEND_OTHER);

    if (naIndex === -1) {
      sortedKeys.push(remainderKey);
    } else {
      sortedKeys.splice(naIndex, 0, remainderKey);
    }
  }

  return { series: series as K[], sortedKeys: sortedKeys as K[] };
}

// Paint order for categorical color groups within one facet (or across the
// whole plot when `facet` is null).
//
// Smallest last in the returned array is NOT the convention: callers reverse
// their trace list, so this returns ascending by count and the smallest ends up
// drawn last, on top. The size that decides burial is the size *within the
// facet* — facets partition the points, so a color that is rare overall can
// dominate one panel and be a handful of points in another.
export function orderColorKeysByCount(
  colorMap: Map<LegendKey, string>,
  colorData: LegendKey[],
  facetData: LegendKey[] | null,
  facet: LegendKey | null,
  visible: boolean[],
  // The plotted positions, for the tiebreak. Optional, but worth supplying:
  // counts tie constantly. Coloring by an expansion member gives every color
  // exactly one point per index entity, so every group is the same size and
  // count alone can say nothing about which should sit on top.
  //
  // Spread can. A tightly clustered group covers few pixels and disappears
  // under anything drawn over it; a diffuse one loses almost nothing by sitting
  // underneath. So the tighter group goes on top. This is variance, not
  // clustering — one more accumulator in the pass that already counts.
  axes?: (number | null)[][]
): LegendKey[] {
  const counts = new Map<LegendKey, number>();
  const sums = new Map<LegendKey, number[]>();
  const sumSquares = new Map<LegendKey, number[]>();

  for (let i = 0; i < colorData.length; i += 1) {
    if (visible[i] === false) {
      continue;
    }

    if (facet !== null && facetData && facetData[i] !== facet) {
      continue;
    }

    const key = colorData[i];
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (axes) {
      if (!sums.has(key)) {
        sums.set(
          key,
          axes.map(() => 0)
        );
        sumSquares.set(
          key,
          axes.map(() => 0)
        );
      }

      for (let a = 0; a < axes.length; a += 1) {
        const value = axes[a][i];

        if (typeof value === "number") {
          sums.get(key)![a] += value;
          sumSquares.get(key)![a] += value * value;
        }
      }
    }
  }

  // Summed across axes, so a group tight on both counts as tighter than one
  // tight on only one. Unitless comparison isn't a concern: every group is
  // being measured on the same axes.
  const spreadOf = (key: LegendKey) => {
    const n = counts.get(key) ?? 0;
    const sum = sums.get(key);
    const sumSq = sumSquares.get(key);

    if (!sum || !sumSq || n < 2) {
      return 0;
    }

    return sum.reduce((running, s, a) => {
      const mean = s / n;
      return running + Math.max(0, sumSq[a] / n - mean * mean);
    }, 0);
  };

  // The three catch-all identities go to the bottom together. The remainder
  // bucket belongs with them: it is the collapsed categories, and burying the
  // individually-named ones under it would undo the point of naming them.
  const isCatchAll = (key: LegendKey) =>
    key === LEGEND_OTHER || key === LEGEND_NEITHER || key === LEGEND_REMAINDER;

  // Per facet, drop colors with nothing in this panel rather than emitting an
  // empty trace for each.
  const keys = [...colorMap.keys()].filter(
    (key) => facet === null || (counts.get(key) ?? 0) > 0
  );

  return [
    ...keys
      .filter((key) => !isCatchAll(key))
      .sort((a, b) => {
        const byCount = (counts.get(a) ?? 0) - (counts.get(b) ?? 0);

        return byCount === 0 ? spreadOf(a) - spreadOf(b) : byCount;
      }),
    ...keys.filter(isCatchAll),
  ];
}

function makeCategoricalColorMap(
  values: string[] | null,
  dimensions: Record<string, { dataset_id: string; values: unknown[] }> | null,
  filters: Record<string, { values: boolean[] }> | null,
  metadata: DataExplorerMetadata | null,
  palette: DataExplorerColorPalette,
  target: "color" | "facet" = "color",
  cap: number = SOFT_MAX_CATEGORIES,
  chosen?: string[] | null
) {
  const out: Map<LegendKey, string> = new Map();

  if (!values) {
    return out;
  }

  const visible = filters?.visible?.values || Array(values.length).fill(true);
  const counts = categoricalDataToValueCounts(values, visible);

  // Which categories survive is getShownCategories' answer, not this
  // function's. It used to be decided here, which is how the other consumers
  // came to disagree with it.
  const { shown, hasRemainder } = getShownCategories(
    values,
    dimensions,
    filters,
    cap,
    chosen
  );

  const keys = ([...counts.keys()].filter(Boolean) as string[])
    .filter((key) => shown.has(key))
    .sort(compareNaturally);

  const legacySliceId = (metadata?.[`${target}_property`] as {
    slice_id?: string;
  })?.slice_id;

  if (
    legacySliceId?.startsWith("slice/mutations_prioritized/") ||
    dimensions?.[target]?.dataset_id === wellKnownDatasets.mutations_prioritized
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

  if (hasRemainder) {
    out.set(LEGEND_REMAINDER, REMAINDER_FILL);
  }

  if (hasPlottableNulls(values, dimensions, visible, target)) {
    out.set(LEGEND_OTHER, palette.other);
  }

  return out;
}

// Whether a facet key list partitions anything, or is just the placeholder
// track calcDensityStats hands back when facet_by is unset.
//
// The list is never absent and never empty, so `Boolean(keys)` answers "did the
// stats run" rather than "is facet_by doing something" — a distinction that is
// invisible until something branches on it, at which point an unfaceted plot
// grows a Facets panel whose only row is "All".
//
// The config-side counterpart is getColorMap's hasRealFacetBacking below, which
// asks computeFacets instead. The two agree: LEGEND_ALL alone is exactly what an
// unset facet_by produces.
export function hasRealFacetPartition(
  sortedFacetKeys: LegendKey[] | undefined
): boolean {
  return Boolean(
    sortedFacetKeys &&
      !(sortedFacetKeys.length === 1 && sortedFacetKeys[0] === LEGEND_ALL)
  );
}

export function getColorMap(
  data: any,
  plotConfig: any,
  palette: DataExplorerColorPalette,
  sortedLegendKeys?: any
): Map<LegendKey, string> {
  const { mode, target } = resolveColorMode(plotConfig);

  // Whether facet_by has real backing, independent of what color resolved
  // to — mirrors PrototypeDensity1D's hasRealFacetBacking and
  // PrototypeScatterPlot's hasFacetOptionsEnabled. The LEGEND_ALL swatch
  // must match whatever color the points/violins actually render: neutral
  // when facet_by is doing something on its own even though color isn't,
  // palette.all only when nothing is set at all.
  const hasRealFacetBacking = Boolean(
    data &&
      computeFacets(
        data,
        plotConfig.facet_by,
        "facet",
        chosenCategoriesFor(plotConfig, "facet")
      )
  );
  const allColor = hasRealFacetBacking ? NEUTRAL_FACET_FILL : palette.all;

  if (!data || data.dimensions?.[target]?.values?.length === 0) {
    return new Map([[LEGEND_ALL, allColor]]);
  }

  let colorMap: Map<LegendKey, string> = new Map();

  const catSlice = findCategoricalSlice(data, mode, target);
  const contSlice = findContinuousColorSlice(data, target);

  if (catSlice) {
    colorMap = makeCategoricalColorMap(
      catSlice.values as string[],
      data.dimensions,
      data.filters,
      data.metadata,
      palette,
      target,
      SOFT_MAX_CATEGORIES,
      chosenCategoriesFor(plotConfig, target)
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

  const filter1 = data.filters?.[`${target}1`];
  const filter2 = data.filters?.[`${target}2`];

  if (filter1) {
    if (hasSomeUniqueValues(filter1.values, filter2?.values)) {
      const { name } = filter1;
      colorMap.set(name, palette.compare1);
    }
  }

  if (filter2) {
    if (hasSomeUniqueValues(filter2.values, filter1?.values)) {
      const { name } = filter2;
      colorMap.set(name, palette.compare2);
    }
  }

  if (
    filter1 &&
    filter2 &&
    hasSomeMatchingTrueValue(filter1.values, filter2.values)
  ) {
    colorMap.set(LEGEND_BOTH, palette.compareBoth);
  }

  if (filter1 || filter2) {
    if (
      hasSomeUncoloredPoints(filter1?.values, filter2?.values, data.dimensions)
    ) {
      colorMap.set(LEGEND_NEITHER, palette.other);
    }
  }

  if (
    data.dimensions[target] &&
    hasSomeNullValuesUniqueToDimension(data.dimensions, target)
  ) {
    colorMap.set(LEGEND_OTHER, palette.other);
  }

  if (colorMap.size === 0) {
    colorMap.set(LEGEND_ALL, allColor);
  }

  if (sortedLegendKeys) {
    colorMap = reorderColorMap(colorMap, sortedLegendKeys);
  }

  return colorMap;
}

// Applies density_1d/waterfall's legend ordering to a color map.
//
// `sortedLegendKeys` is an ORDER and nothing more. It is derived from the data,
// so it names categories the color map may have deliberately left out, and it
// knows nothing about buckets that aren't categories.
export function reorderColorMap(
  colorMap: Map<LegendKey, string>,
  sortedLegendKeys: LegendKey[]
): Map<LegendKey, string> {
  const sortedColorMap: Map<LegendKey, string> = new Map();

  sortedLegendKeys.forEach((key: LegendKey) => {
    // `sortedLegendKeys` is an ORDER, derived from the data, so it still
    // names every category — including the ones the ranking collapsed into
    // the remainder bucket. Re-adding those here would give them an undefined
    // color and put them back in the legend as blank rows backing no points,
    // where toggling them does nothing.
    //
    // Only string keys, because only categories can be collapsed. The symbol
    // keys pass through exactly as before, undefined color included — the
    // continuous-N/A path currently depends on this branch creating its entry
    // (see the LEGEND_OTHER reorder test), and that is a separate thread to
    // pull.
    if (typeof key === "string" && !colorMap.has(key)) {
      return;
    }

    sortedColorMap.set(key, colorMap.get(key)!);
  });

  // Anything the ordering doesn't know about — the remainder bucket, which is
  // not a category and so was never in the data the order was derived from.
  // Dropping it would take the bucket out of the legend and out of the paint
  // path with it, since both read the color map.
  colorMap.forEach((color, key) => {
    if (!sortedColorMap.has(key)) {
      sortedColorMap.set(key, color);
    }
  });

  // Keep N/A last, as every branch of sortLegendKeys already arranges. A Map
  // won't move an existing key on re-set, hence the delete.
  if (sortedColorMap.has(LEGEND_OTHER)) {
    const naColor = sortedColorMap.get(LEGEND_OTHER)!;
    sortedColorMap.delete(LEGEND_OTHER);
    sortedColorMap.set(LEGEND_OTHER, naColor);
  }

  return sortedColorMap;
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
      facet1?: { name: string };
      facet2?: { name: string };
    };
  },
  continuousBins: ContinuousBins,
  // Which triad's filters (color1/color2 vs facet1/facet2) back a LEGEND_BOTH
  // label. Deliberately no default: under the version-2 default flip, an
  // absent color_by defers to facet_by, so "color" is no longer a safe
  // universal fallback — the correct target depends on resolveColorMode, not
  // on this parameter being omitted. Every caller must resolve and pass it
  // explicitly.
  target: "color" | "facet"
) {
  if (category === LEGEND_BOTH) {
    const filter1 =
      target === "facet" ? data.filters.facet1 : data.filters.color1;
    const filter2 =
      target === "facet" ? data.filters.facet2 : data.filters.color2;
    return `Both (${[filter1!.name, filter2!.name].join(" & ")})`;
  }

  if (category === LEGEND_ALL) {
    return "All";
  }

  if (category === LEGEND_REMAINDER) {
    return "Other categories";
  }

  // LEGEND_NEITHER (a real, explicit "in neither selected context" bucket)
  // and LEGEND_OTHER (missing/null data) are distinct identities precisely
  // so this never has to guess which display text applies — see their
  // shared comment at the top of the file.
  if (category === LEGEND_NEITHER) {
    return "Other";
  }

  if (category === LEGEND_OTHER) {
    return "N/A";
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

// Trims a facet's name to what its label can hold.
//
// Both faceted renderers need this and neither has room to negotiate: the
// density plot writes these as y-axis tick text, where a long name pushes the
// left margin until the panels themselves are squeezed, and the small-multiples
// scatter writes them as titles centered over panels only a fraction of the
// figure wide. An untrimmed name silently overlaps its neighbors in the second
// case rather than being clipped.
//
// 25 is what the density plot has always used, and stays its budget: its tracks
// are stacked vertically, so a name has the full figure width whatever the facet
// count. The scatter passes a smaller number as its grid tightens — see
// facetLabelBudget. The full names remain in the Facets panel either way.
const DEFAULT_MAX_FACET_LABEL = 25;

export function truncateFacetLabel(
  s: string,
  maxChars: number = DEFAULT_MAX_FACET_LABEL
) {
  return s && s.length > maxChars ? `${s.substr(0, maxChars)}…` : s;
}

// How many characters a facet title can hold above one panel of a `cols`-wide
// grid, given the grid's total width in pixels (the figure minus its left and
// right margins, which is what a paper-referenced annotation spans).
//
// Plotly isn't deciding the layout — SmallMultiplesScatter is, at a fixed
// `cols = ceil(sqrt(F))` — so this is arithmetic rather than a guess about what
// the library will do.
//
// What a title must not outgrow is the column *pitch*, not the panel's own
// domain. Adjacent titles are centered over adjacent panels, so a long one may
// spill into the gutter on both sides and still clear its neighbors; the two
// collide only once their average width passes the distance between panel
// centers. GUTTER keeps them from touching when both run long.
//
// The character count comes from an assumed average glyph advance rather than a
// measurement, since there is nothing rendered to measure at layout time.
// Plotly's default stack is Verdana-like, whose lowercase runs near 0.6em;
// overestimating is the safe direction, as it only trims harder. Clamped at both
// ends: a dense grid still shows enough of each name to tell them apart, and a
// roomy one doesn't start showing more than the density plot would.
//
// Measured at build time, so it doesn't follow a window resize — Plotly's
// resize path repaints the existing annotations rather than rebuilding them.
// Widening is harmless and narrowing lands back on the fixed-25 behavior this
// replaced, until the next config change rebuilds the figure.
export function facetLabelBudget({
  gridWidth,
  cols,
  fontSize,
}: {
  gridWidth: number;
  cols: number;
  fontSize: number;
}): number {
  const MIN_CHARS = 8;
  const GUTTER = 8;
  const EM_PER_CHAR = 0.6;

  // Nothing measured yet (first pass, or a detached node). Anything derived
  // from a zero width would trim to the floor, which is far worse than the
  // untightened default.
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) {
    return DEFAULT_MAX_FACET_LABEL;
  }

  const pitch = gridWidth / Math.max(1, cols);
  const chars = Math.floor((pitch - GUTTER) / (fontSize * EM_PER_CHAR));

  return Math.min(DEFAULT_MAX_FACET_LABEL, Math.max(MIN_CHARS, chars));
}

// Flattens categoryToDisplayName's result (a plain string, or a [min, max]
// tuple for a continuous bin) into a single display string. Every caller
// that builds a legend/label list from category keys was hand-rolling this
// same `typeof name === "string" ? name : \`${name[0]} – ${name[1]}\`` check.
export function formatCategoryLabel(
  category: LegendKey,
  data: Parameters<typeof categoryToDisplayName>[1],
  continuousBins: ContinuousBins,
  target: "color" | "facet"
): string {
  const name = categoryToDisplayName(category, data, continuousBins, target);
  return typeof name === "string" ? name : `${name[0]} – ${name[1]}`;
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
    // all-null facet has no value to sort by). This preserves sort_by for the
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

// Bins a continuous slice's raw values into a per-point LEGEND_RANGE_*
// series, plus the represented bins in natural (ascending-value) order —
// natural order already IS "sorted by value ascending" since calcBins
// builds bins low-to-high by construction, so callers never need to
// consult sort_by here (unlike the categorical case). Filtered to bins
// with at least one currently-visible point, unless `includeEmpty` (the
// expanded world), which keeps every bin as a placeholder.
//
// Shared by every renderer path that needs continuous-bin faceting
// independent of computeDensitySeriesForMode's fuller color/facet dispatch
// — waterfall's x-clustering and scatter's faceting, both of which have no
// categorical/continuous dispatch of their own the way density's does.
export function computeContinuousLegendKeySeries(
  values: (number | null)[],
  continuousBins: ContinuousBins,
  visible?: boolean[],
  includeEmpty = false
): {
  series: LegendKey[];
  unusedKeys: Set<LegendKey>;
  sortedKeys: LegendKey[];
} | null {
  if (!continuousBins) {
    return null;
  }

  const [series, unusedKeys] = continuousValuesToLegendKeySeries(
    values,
    continuousBins,
    visible
  );

  const sortedKeys = (Reflect.ownKeys(continuousBins) as LegendKey[]).filter(
    (key) => includeEmpty || !unusedKeys.has(key)
  );

  // A null value gets its own LEGEND_OTHER ("N/A") entry per point (via
  // `series` above), but LEGEND_OTHER is never one of continuousBins' own
  // keys (calcBins only ever produces the 10 real range bins) — so it's
  // never picked up by the filter above and must be appended explicitly.
  // Appended last since it isn't part of the ascending numeric order.
  // `unusedKeys` can't tell us whether it's actually represented either
  // (it's seeded from continuousBins' own keys, so LEGEND_OTHER is never a
  // member of it either way) — checking `series` directly, mirroring
  // computeFacets' own `binned.series.includes(LEGEND_OTHER)` check, is
  // what makes this and computeFacets agree on when a null-value entry is
  // warranted.
  if (includeEmpty || series.includes(LEGEND_OTHER)) {
    sortedKeys.push(LEGEND_OTHER);
  }

  return { series, unusedKeys, sortedKeys };
}

// Partitions points by up to two boolean membership filters (color1/color2
// or facet1/facet2) into up to 4 buckets: in filter1 only (named after it),
// in filter2 only, in BOTH (LEGEND_BOTH, "Both (X & Y)"), or in NEITHER
// (LEGEND_NEITHER, "Other" — a real, fittable classification, not missing
// data — see LEGEND_NEITHER's own comment for why this is a distinct
// identity from LEGEND_OTHER). Shared by computeDensitySeriesForMode
// (density's color/facet axes) and computeFacets (waterfall's clustering /
// scatter's faceting, regression lines/table) — the same primitive
// color_by's custom-filter mode already used, extended so facet_by gets
// identical behavior.
//
// `sortedKeys` is the canonical order [filter1.name, filter2.name,
// LEGEND_BOTH, LEGEND_NEITHER], filtered to entries actually represented
// (filter1/filter2's own names are always "represented" by definition —
// they're real user selections; LEGEND_BOTH/LEGEND_NEITHER only when at
// least one currently-visible point landed there). This is the same order
// getColorMap independently builds for color_by, so a caller reordering by
// these sortedKeys is a no-op for color and, for the first time, gives
// facet_by a real key/order set instead of `undefined`.
export function computeCustomFilterSeries(
  filter1: { name: string; values: (boolean | null)[] } | undefined,
  filter2: { name: string; values: (boolean | null)[] } | undefined,
  visible?: { values: boolean[] }
): {
  series: any[];
  unusedKeys: Set<unknown>;
  sortedKeys: (string | symbol)[];
} {
  const out: any[] = [];
  const len = (filter1 || filter2)!.values.length;
  const unusedKeys = new Set(
    filter1 && filter2 ? [LEGEND_BOTH, LEGEND_NEITHER] : [LEGEND_NEITHER]
  );

  for (let i = 0; i < len; i += 1) {
    if (filter1?.values[i] && filter2?.values[i]) {
      out[i] = LEGEND_BOTH;

      if (!visible || visible.values[i]) {
        unusedKeys.delete(LEGEND_BOTH);
      }
    } else if (filter1?.values[i]) {
      out[i] = filter1.name;
    } else if (filter2?.values[i]) {
      out[i] = filter2.name;
    } else {
      out[i] = LEGEND_NEITHER;

      if (!visible || visible.values[i]) {
        unusedKeys.delete(LEGEND_NEITHER);
      }
    }
  }

  const sortedKeys = [
    filter1 ? filter1.name : null,
    filter2 ? filter2.name : null,
    filter1 && filter2 && !unusedKeys.has(LEGEND_BOTH) ? LEGEND_BOTH : null,
    !unusedKeys.has(LEGEND_NEITHER) ? LEGEND_NEITHER : null,
  ].filter((key) => key !== null) as (string | symbol)[];

  return { series: out, unusedKeys, sortedKeys };
}

// Computes the per-point legend-key series for a single axis (color_by or
// facet_by). The same logic that calcDensityStats used to do inline; pulled
// out so we can call it once for the coloring concern and once for the
// (fully independent) faceting concern.
//
// `target` picks which triad backs this axis: "color" reads
// filters.color1/color2 + dimensions.color + metadata.color_property;
// "facet" reads the parallel filters.facet1/facet2 + dimensions.facet +
// metadata.facet_property. The two are never mixed.
//
// Each branch corresponds to a category of source:
//   - "custom"                 → <target>1/<target>2 filter values
//   - categorical fall-through → catData (mode-aware: expansion when applicable,
//                                otherwise the target's own dimension / property)
//   - continuous fall-through  → contData (binned)
//
// The "custom" branch only fires when <target>1/<target>2 are actually
// present; otherwise we fall through. That matches the existing auto-dispatch
// and keeps callers that don't set mode explicitly behaving the same as today.
function computeDensitySeriesForMode(
  data: any,
  continuousBins: any,
  sort_by: string | undefined,
  mode: ColorByValue | undefined,
  target: "color" | "facet" = "color",
  includeEmpty = false,
  chosen?: string[] | null
): {
  series: any[] | null;
  unusedKeys: Set<unknown>;
  sortedKeys?: any[];
} {
  const filter1 =
    target === "facet" ? data?.filters?.facet1 : data?.filters?.color1;
  const filter2 =
    target === "facet" ? data?.filters?.facet2 : data?.filters?.color2;
  const visible = data?.filters?.visible;

  const catData = findCategoricalSlice(data, mode, target);

  // Custom (facet1/facet2 or color1/color2 filter) branch. It owns this axis
  // when the mode is "custom"/unset, and also when an explicit non-"expansion"
  // mode has no categorical source of its own — e.g. aggregated_slice/raw_slice
  // with a color1/color2 filter but no color dimension. Without that fallback
  // this axis's series would be empty and the renderer then builds zero point
  // traces (every point vanishes). We still never let filters override the
  // "expansion" side or a real categorical dimension.
  const useCustomFilter =
    Boolean(filter1 || filter2) &&
    (mode === "custom" ||
      mode === undefined ||
      (mode !== "expansion" && !catData));

  if (useCustomFilter) {
    return computeCustomFilterSeries(filter1, filter2, visible);
  }

  if (catData) {
    const counts: Record<string, number> = {};
    const unusedKeys = new Set<unknown>();

    // A missing `visible` filter means every point is visible — it must NOT
    // disable the no-data bookkeeping. (It used to: unusedKeys were only
    // computed when a visible filter happened to exist, so a category whose
    // points are all null on x — e.g. an expansion member the dataset
    // doesn't measure — was never flagged unless something was also
    // filtered.)
    for (let i = 0; i < catData.values.length; i += 1) {
      const category = catData.values[i];

      if (category) {
        counts[category] = counts[category] || 0;
        counts[category] +=
          (!visible || visible.values[i]) &&
          data.dimensions.x.values[i] !== null
            ? 1
            : 0;
      }
    }

    Object.keys(counts).forEach((category) => {
      if (counts[category] === 0) {
        unusedKeys.add(category);
      }
    });

    // Collapsed categories share the remainder's series and its key, or
    // density_1d and waterfall would draw a separate curve for each of them —
    // uncolored, with no legend row to explain or toggle it, and a Facets
    // panel still offering them as though they were there.
    const collapsed = collapseCategoricalSeries(
      catData.values as (string | null)[],
      data.dimensions,
      data.filters,
      sortLegendKeys1D(data, catData, sort_by, includeEmpty) as LegendKey[],
      chosen
    );

    return {
      series: collapsed.series,
      unusedKeys,
      sortedKeys: collapsed.sortedKeys,
    };
  }

  // Expansion is always categorical; if mode === "expansion" we never reach
  // contData. Other modes can fall through to a continuous source.
  if (mode !== "expansion") {
    const contData = findContinuousColorSlice(data, target);
    if (contData) {
      // `sortedKeys` matters here just as much as for the categorical
      // branch above: when target === "facet" and this is left undefined,
      // the density renderer's `effectiveFacetKeys = facetKeysProp ??
      // colorKeys` silently falls back to COLOR's legend keys for track
      // identity/order — which happens to look right only when color is
      // ALSO continuous (and shares the same bins), and produces zero/wrong
      // violin tracks the moment color_by changes to anything else.
      const binned = computeContinuousLegendKeySeries(
        contData.values,
        continuousBins,
        data.filters?.visible?.values,
        includeEmpty
      );

      if (binned) {
        return binned;
      }
    }
  }

  return { series: null, unusedKeys: new Set() };
}

// Returns the per-point series for both coloring and faceting, plus the
// associated legend metadata. `facet_by` is a fully independent axis from
// `color_by` — it does NOT fall back to color_by when unset. Both an unset
// `facet_by` AND a set-but-not-yet-backed `facet_by` (a mode picked with no
// real data behind it yet) mean "no faceting": every point lands in a
// single LEGEND_ALL track, in both the expanded and non-expanded world.
// colorData drives bgcolor; facetData drives violin-track assignment.
export function calcDensityStats(
  data: any,
  continuousBins: any,
  sort_by: string | undefined,
  // The RESOLVED color mode (see resolveColorMode) — never a raw color_by.
  // color_by can itself be "facet"/"uniform" (version 2), so the caller
  // must resolve it first; this function only ever deals in the effective
  // (mode, target) pair, exactly like facet_by's own side below (which
  // never needs resolution, since facet_by is never itself "facet"/
  // "uniform").
  colorMode: { mode: ColorByValue | undefined; target: "color" | "facet" },
  facet_by?: ColorByValue,
  // Facet's OWN continuous bins — never color's. A continuous
  // color_property/facet_property each get their own independent 10-bin
  // scale from their own values; sharing `continuousBins` here (color's)
  // would either silently be null (when color isn't continuous, dropping
  // facet's binning entirely) or apply the wrong boundaries (when color IS
  // continuous but a different slice than facet). The caller computes this
  // from facet's own continuous values, mirroring how `continuousBins` is
  // computed from color's.
  facetContinuousBins: any = null,
  isExpanded = false,
  // The categories the user picked by hand, per side, or absent to let the
  // automatic ranking choose. Grouped into one trailing object rather than two
  // more positional parameters: this signature is already seven long, and the
  // color half would otherwise sit four arguments away from the `colorMode` it
  // belongs to.
  //
  // Threading these was the whole bug. Every other renderer reaches
  // getShownCategories with the chosen list in hand — the waterfall through
  // collapseCategoricalSeries, the scatter through computeFacets, the legend
  // through getColorMap — but density's series come from here, and here had no
  // parameter to carry them. Both sides were affected; only the facet half got
  // noticed, because that is the one with a panel next to it to disagree with.
  chosen: { color?: string[] | null; facet?: string[] | null } = {}
) {
  // When the color legend IS the expansion (mode "expansion" — the
  // color_by/facet_by-equivalent configuration where the Legend panel
  // doubles as the facet key), it must list every windowed member the same
  // way the facet side below does: no-data members appear toggled off by
  // default (they're in unusedKeys) rather than vanishing from the list
  // entirely. Scoped to the expansion mode — other color modes keep their
  // existing only-represented-keys legends.
  const colorSide = computeDensitySeriesForMode(
    data,
    continuousBins,
    sort_by,
    colorMode.mode,
    colorMode.target,
    isExpanded && colorMode.mode === "expansion",
    chosen.color
  );

  // isExpanded is threaded through as `includeEmpty`: the facet side needs
  // every windowed transcript (incl. all-null ones the dataset doesn't
  // measure) so each gets a track — a "(no data)" placeholder for the
  // empties, keeping the page at its full window size.
  const facetSide = facet_by
    ? computeDensitySeriesForMode(
        data,
        facetContinuousBins,
        sort_by,
        facet_by,
        "facet",
        isExpanded,
        chosen.facet
      )
    : null;

  // Unset facet_by, and a SET-BUT-UNBACKED facet_by (a mode picked in the
  // dropdown with no real data yet — e.g. facet_by: "property" before an
  // annotation is chosen), must render identically: a single LEGEND_ALL
  // track. Without this, the live render would visibly split into one
  // track per color category the instant an incomplete mode is picked,
  // even though a page reload (which strips an incomplete facet_by
  // entirely — see normalizePlot's completeness checks) would show the
  // single-track appearance. Both "no mode selected" and "mode selected,
  // nothing found" collapse to the exact same rendering here so there's no
  // in-between state for the renderer to visibly diverge on.
  if (!facetSide || !facetSide.series) {
    return {
      colorData: colorSide.series,
      facetData: colorSide.series
        ? colorSide.series.map(() => LEGEND_ALL)
        : null,
      unusedKeys: colorSide.unusedKeys as Set<LegendKey>,
      unusedFacetKeys: new Set<LegendKey>(),
      sortedColorKeys: colorSide.sortedKeys,
      // Cast needed because this return site is no longer the function's
      // only early return (see the `facetSide` guard above): without an
      // explicit type here, TS widens `LEGEND_ALL`'s unique symbol literal
      // down to plain `symbol` when merging this return's type with the
      // one below, which no longer satisfies `LegendKey[]` for callers.
      sortedFacetKeys: [LEGEND_ALL] as LegendKey[],
    };
  }

  return {
    colorData: colorSide.series,
    facetData: facetSide.series,
    // computeDensitySeriesForMode types unusedKeys as Set<unknown>; narrow at
    // this boundary, matching the `as Set<LegendKey>` casts used on the other
    // unused-key paths in this file. Consumers expect Set<LegendKey>.
    unusedKeys: colorSide.unusedKeys as Set<LegendKey>,
    // Facet's own no-data keys — the Facets panel seeds its default-hidden
    // set from these, mirroring how the Legend panel seeds from unusedKeys.
    unusedFacetKeys: facetSide.unusedKeys as Set<LegendKey>,
    sortedColorKeys: colorSide.sortedKeys,
    sortedFacetKeys: facetSide.sortedKeys,
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

export interface LegendInfo {
  title: string;
  items: { name: string; hexColor: string }[];
}

const truncateLegendName = (s: string) => {
  const MAX = 25;
  return s && s.length > MAX ? `${s.substr(0, MAX)}…` : s;
};

// These dummy traces exist only to force Plotly to add a legend with the
// correct colors to a downloaded image (there is no good way of rendering our
// custom legend as part of the exported image). Shared by both scatter
// renderers (single-panel PrototypeScatterPlot and the faceted
// SmallMultiplesScatter) — see either's `downloadImage` implementation.
export const getLegendTraces = (
  legendForDownload: LegendInfo,
  templateTrace: object & { marker: object }
) =>
  legendForDownload.items.map(({ name, hexColor }) => {
    return {
      ...templateTrace,
      showlegend: true,
      // HACK: Use a plot type of "indicator" rather than "scatter". This
      // prevents a rare bug where these dummy traces interfere with the
      // real ones and some points don't get rendered.
      type: "indicator",
      name: truncateLegendName(name),
      x: [null], // Data doesn't matter but can't be completely empty
      y: [null],
      marker: {
        ...templateTrace.marker,
        color: hexColor,
        line: { color: hexColor, width: 2 },
      },
    };
  });

export interface SolidColorGroup {
  color: string;
  // Membership in this color facet, by point index. Deliberately ignores point
  // visibility, facet membership, and opposite-axis nulls — those masks belong
  // to the renderer, not to the color semantics.
  includes: (i: number) => boolean;
}

// Pure color-faceting seam shared by the scatter renderers (single-panel and
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

// Per-group positional variance, summed across axes. Shared by the two paint
// orderings so they break ties the same way.
function spreadByKey(
  catColorData: (string | number | null)[] | null,
  visible: boolean[],
  axes?: (number | null)[][]
): Map<string, number> {
  const out = new Map<string, number>();

  if (!catColorData || !axes || axes.length === 0) {
    return out;
  }

  const counts = new Map<string, number>();
  const sums = new Map<string, number[]>();
  const sumSquares = new Map<string, number[]>();

  for (let i = 0; i < catColorData.length; i += 1) {
    if (!visible[i] || catColorData[i] == null) {
      continue;
    }

    const key = String(catColorData[i]);

    if (!sums.has(key)) {
      counts.set(key, 0);
      sums.set(
        key,
        axes.map(() => 0)
      );
      sumSquares.set(
        key,
        axes.map(() => 0)
      );
    }

    counts.set(key, counts.get(key)! + 1);

    for (let a = 0; a < axes.length; a += 1) {
      const value = axes[a][i];

      if (typeof value === "number") {
        sums.get(key)![a] += value;
        sumSquares.get(key)![a] += value * value;
      }
    }
  }

  counts.forEach((n, key) => {
    if (n < 2) {
      out.set(key, 0);
      return;
    }

    out.set(
      key,
      sums.get(key)!.reduce((running, s, a) => {
        const mean = s / n;
        return running + Math.max(0, sumSquares.get(key)![a] / n - mean * mean);
      }, 0)
    );
  });

  return out;
}

export function getSolidColorGroups(args: {
  color1: (boolean | null)[] | null;
  color2: (boolean | null)[] | null;
  catColorData: (string | number | null)[] | null;
  colorMap: Map<LegendKey, string>;
  palette: DataExplorerColorPalette;
  visible: boolean[];
  // Positions, for the same tiebreak orderColorKeysByCount uses — see its
  // comment. Counts tie whenever color is an expansion member, and then only
  // spread can say which group is at risk of being buried.
  axes?: (number | null)[][];
}): SolidColorGroup[] {
  const {
    color1,
    color2,
    catColorData,
    colorMap,
    palette,
    visible,
    axes,
  } = args;

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

  // Categorical mode: one facet per category value that has visible points,
  // plus "other" for nulls.
  if (catColorData) {
    const counts = categoricalDataToValueCounts(
      catColorData.map((v) => (v == null ? null : String(v))),
      visible
    );

    // Larger first, i.e. at the bottom. Note this is the opposite array
    // convention from orderColorKeysByCount, whose caller reverses.
    const spread = spreadByKey(catColorData, visible, axes);

    const groups: (SolidColorGroup & { key: string })[] = [...colorMap.keys()]
      .filter((key): key is string => typeof key === "string")
      .map((key) => ({ key, count: counts.get(key) || 0 }))
      // Drop categories with no visible points; otherwise faceting multiplies
      // empty traces by the facet count.
      .filter(({ count }) => count > 0)
      .sort((a, b) => {
        if (a.count !== b.count) {
          return a.count < b.count ? 1 : -1;
        }

        // Tied: the more diffuse group goes underneath.
        return (spread.get(b.key) ?? 0) - (spread.get(a.key) ?? 0);
      })
      .map(({ key }) => ({
        key,
        color: colorMap.get(key)!,
        includes: (i: number) => String(catColorData[i]) === key,
      }));

    // Categories that didn't earn their own color still have to be drawn, or
    // they would vanish from the plot rather than being de-emphasised in it.
    // Derived from the color map rather than passed in separately, so there is
    // one answer to "which categories are shown" and not two that can disagree.
    const shown = new Set(groups.map((g) => g.key));

    const remainder: SolidColorGroup[] = colorMap.has(LEGEND_REMAINDER)
      ? [
          {
            color: REMAINDER_FILL,
            includes: (i: number) =>
              catColorData[i] != null && !shown.has(String(catColorData[i])),
          },
        ]
      : [];

    return [
      { color: palette.other, includes: (i) => catColorData[i] == null },
      ...remainder,
      ...groups.map(({ color, includes }) => ({ color, includes })),
    ];
  }

  // No color enabled: one facet covering every point. This function is only
  // ever called from within SmallMultiplesScatter, which itself only renders
  // when facet_by is already faceted/real — so this is unconditionally the
  // "facet_by set, color_by has nothing of its own" case, never the vanilla
  // no-facet-at-all case (that one never reaches small multiples).
  return [{ color: NEUTRAL_FACET_FILL, includes: () => true }];
}
