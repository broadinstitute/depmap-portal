import { useMemo } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  calcBins,
  calcDensityStats,
  calcVisibility,
  ContinuousBins,
  findCategoricalSlice,
  findContinuousColorSlice,
  formatCategoryLabel,
  formatDataForScatterPlot,
  getColorMap,
  LegendKey,
  nullifyUnplottableValues,
  resolveColorMode,
  useLegendState,
} from "./plotUtils";

type Palette = Parameters<typeof getColorMap>[2];

export interface Density1DPlotData {
  formattedData: {
    annotationText: string[];
    catColorData: (string | number | null)[] | null;
    color1: (boolean | null)[] | null;
    color2: (boolean | null)[] | null;
    contColorData: (number | null)[] | null;
    hoverText: string[];
    x: (number | null)[] | null;
    y: (number | null)[] | null;
    xLabel: string | null;
    yLabel: string | null;
  } | null;
  continuousBins: ContinuousBins;
  // colorData: drives point colors (bgcolor). Sourced from color_by.
  colorData: unknown;
  // facetData: drives violin-track assignment. Sourced from facet_by; a
  // single LEGEND_ALL track when facet_by is unset (see calcDensityStats).
  facetData: unknown;
  legendKeysWithNoData: Set<LegendKey> | null;
  // sortedLegendKeys: order of legend entries (color side).
  sortedLegendKeys: LegendKey[] | undefined;
  // sortedFacetKeys: order of violin tracks (facet side). Same array as
  // sortedLegendKeys when modes match.
  sortedFacetKeys: LegendKey[] | undefined;
  // facetContinuousBins: facet's own bins, independent of continuousBins
  // (color's own) — needed by the Facets panel to label a continuous
  // facet's LEGEND_RANGE_* keys via categoryToDisplayName.
  facetContinuousBins: ContinuousBins;
  legendState: ReturnType<typeof useLegendState>;
  colorMap: Map<LegendKey, string>;
  legendDisplayNames: Partial<Record<LegendKey, string>>;
  // facetDisplayNames: violin-track labels, keyed the same way as
  // legendDisplayNames but built from facet's own continuous bins — see the
  // prop comment on PrototypeDensity1D for why these can't be merged into a
  // single map when both axes bin the same shared LEGEND_RANGE_* symbols.
  facetDisplayNames: Partial<Record<LegendKey, string>>;
  legendTitle: string;
  pointVisibility: boolean[] | null;
  // Drives the "Facets" panel (shown only when color_by/facet_by diverge —
  // see resolveColorMode) — a second, independent useLegendState instance
  // pinned to target "facet", so toggling a facet is entirely separate from
  // toggling a color-legend category.
  facetLegendState: ReturnType<typeof useLegendState>;
  // Which triad (color's own, or facet's own via the version-2 default
  // defer) actually backs the legend — PlotLegend/LegendLabel need this to
  // read the right filters.color1/2 vs facet1/2 pair for a LEGEND_BOTH
  // label. See resolveColorMode.
  colorTarget: "color" | "facet";
  // Whether facet_by and color_by resolve to the SAME underlying source —
  // true whenever colorMode.target is "facet" (color defers to facet_by),
  // but ALSO true when both explicitly name the same real source without
  // either deferring (e.g. facet_by: "expansion", color_by: "expansion" —
  // both read the identical data.expansions-based slice regardless of
  // target). PrototypeDensity1D needs this (not colorTarget alone) to
  // decide whether a violin track may legitimately borrow its color from
  // colorMap / be hidden by a color legend toggle.
  colorMatchesFacet: boolean;
}

// Encapsulates the data-prep pipeline shared by DataExplorerDensity1DPlot and
// EmbeddedDensity1DPlot. Parallel to useScatterPlotData/useWaterfallPlotData,
// but with density-specific differences: `calcDensityStats` produces
// colorData, legendKeysWithNoData, and sortedLegendKeys in one shot;
// `legendDisplayNames` + `legendTitle` are the consumer-facing analogs of
// `legendForDownload` from the other two hooks; `calcVisibility` is called
// with the extra `hide_points` flag.
export default function useDensity1DPlotData(
  data: DataExplorerPlotResponse | null,
  plotConfig: DataExplorerPlotConfig,
  palette: Palette
): Density1DPlotData {
  // Resolves color_by's version-2 default flip / "uniform" opt-out (ADR
  // 0001, ADR 0004) into the effective (mode, target) pair every helper
  // below actually needs. See resolveColorMode's own comment for why this
  // must be the one place color_by is read raw. Deliberately depends only on
  // the two fields resolveColorMode actually reads, not the whole
  // `plotConfig` object, so unrelated plotConfig changes don't invalidate it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colorMode = useMemo(() => resolveColorMode(plotConfig), [
    plotConfig.color_by,
    plotConfig.facet_by,
  ]);

  const formattedData = useMemo(
    () => formatDataForScatterPlot(data, colorMode.mode, colorMode.target),
    [data, colorMode]
  );

  const continuousBins: ContinuousBins = useMemo(
    () =>
      formattedData?.contColorData
        ? calcBins(formattedData.contColorData)
        : null,
    [formattedData]
  );

  // Facet's OWN continuous bins, computed independently from color's — see
  // calcDensityStats's `facetContinuousBins` param comment. Read directly
  // off the response (not `formattedData`, which only ever extracts color's
  // arrays) since facet_by has its own dimension/metadata/filter triad.
  // Nullified the same way formatDataForScatterPlot nullifies color's own
  // contValues (invisible/filtered points, points missing on x or y) so
  // facet's bin edges match color's when both resolve to the same
  // underlying property — otherwise the two would compute min/max over
  // different-sized value sets and produce slightly different buckets.
  const facetContinuousBins: ContinuousBins = useMemo(() => {
    const values = nullifyUnplottableValues(
      findContinuousColorSlice(data, "facet")?.values,
      data?.filters?.visible?.values,
      data ? [data.dimensions.x, data.dimensions.y!] : undefined
    );
    return values ? calcBins(values) : null;
  }, [data]);

  const { sort_by, facet_by, expand_by } = plotConfig;

  // "J4"-style comparison (mirrors regressionLinesByFacet in
  // useScatterPlotData.ts): facet_by and color_by can independently
  // resolve to the SAME underlying source even when color_by doesn't
  // literally defer to facet_by via the "facet" sentinel — e.g.
  // facet_by: "expansion", color_by: "expansion" (explicit, not deferring)
  // still reads the identical data.expansions-based slice regardless of
  // target (findCategoricalSlice's "expansion" branch ignores target
  // entirely). A violin track may only borrow its color from colorMap (and
  // be legend-hideable) when this is true — colorMode.target === "facet"
  // alone misses this explicit-but-coincidentally-same-source case.
  const colorMatchesFacet = useMemo(() => {
    if (colorMode.target === "facet") {
      return true;
    }

    const facetSource =
      findCategoricalSlice(data, facet_by, "facet") ??
      findContinuousColorSlice(data, "facet");
    const colorSource =
      findCategoricalSlice(data, colorMode.mode, "color") ??
      findContinuousColorSlice(data, "color");

    return (
      !!facetSource &&
      !!colorSource &&
      facetSource.label === colorSource.label &&
      facetSource.dataset_id === colorSource.dataset_id
    );
  }, [data, facet_by, colorMode]);

  const {
    colorData,
    facetData,
    unusedKeys: legendKeysWithNoData,
    unusedFacetKeys: facetKeysWithNoData,
    sortedColorKeys: sortedLegendKeys,
    sortedFacetKeys,
  } = useMemo(
    () =>
      calcDensityStats(
        data,
        continuousBins,
        sort_by,
        colorMode,
        facet_by,
        facetContinuousBins,
        Boolean(expand_by?.length)
      ),
    [
      data,
      continuousBins,
      sort_by,
      colorMode,
      facet_by,
      facetContinuousBins,
      expand_by,
    ]
  );

  const legendState = useLegendState(plotConfig, legendKeysWithNoData);
  const { hiddenLegendValues } = legendState;

  // Independent of the color legend's own hidden set — drives the "Facets"
  // panel, shown only when color_by/facet_by diverge (colorMode.target ===
  // "color"). Pinned to target "facet" regardless of what color_by resolves
  // to, so toggling a facet never touches color-legend state or vice versa.
  // Seeded with facet's own no-data keys so facets with nothing to plot
  // start toggled off, mirroring the color legend's own seeding above.
  const facetLegendState = useLegendState(
    plotConfig,
    facetKeysWithNoData,
    "facet"
  );
  const { hiddenLegendValues: hiddenFacetValues } = facetLegendState;

  const colorMap = useMemo(
    () => getColorMap(data, plotConfig, palette, sortedLegendKeys),
    [data, plotConfig, palette, sortedLegendKeys]
  );

  const legendDisplayNames = useMemo(() => {
    const out: Partial<Record<LegendKey, string>> = {};

    if (!data) {
      return out;
    }

    [...colorMap.keys()].forEach((key) => {
      out[key] = formatCategoryLabel(
        key,
        data,
        continuousBins,
        colorMode.target
      );
    });

    return out;
  }, [colorMap, data, continuousBins, colorMode]);

  // Mirrors legendDisplayNames, but for facet's own keys/bins — see the
  // interface comment on why this can't just be merged into
  // legendDisplayNames.
  const facetDisplayNames = useMemo(() => {
    const out: Partial<Record<LegendKey, string>> = {};

    if (!data || !sortedFacetKeys) {
      return out;
    }

    sortedFacetKeys.forEach((key) => {
      out[key] = formatCategoryLabel(key, data, facetContinuousBins, "facet");
    });

    return out;
  }, [data, sortedFacetKeys, facetContinuousBins]);

  let legendTitle = "";

  // dataset_label is legitimately absent for "primary" metadata datasets
  // (see isPrimaryMetatadata in breadboxMethods.ts) — must be appended
  // conditionally, not interpolated unconditionally, or a real `undefined`
  // bakes into the string as the literal text "undefined". Mirrors
  // PlotLegend.tsx's SliceDescription, which already gets this right.
  const legendDim = data?.dimensions?.[colorMode.target];
  if (legendDim) {
    legendTitle = legendDim.dataset_label
      ? `${legendDim.axis_label}<br>${legendDim.dataset_label}`
      : legendDim.axis_label;
  }

  const legendProperty = data?.metadata?.[`${colorMode.target}_property`];
  if (legendProperty) {
    legendTitle = legendProperty.label;

    if (legendProperty.dataset_label) {
      legendTitle += `<br>${legendProperty.dataset_label}`;
    }
  }

  // A point hidden by EITHER axis (color-legend toggle or facet toggle) is
  // hidden. The facet-target pass only ever excludes points once color_by and
  // facet_by have actually diverged in practice (the Facets panel that drives
  // hiddenFacetValues only renders in that case — see the container
  // components), but computing it unconditionally here is cheap and correct
  // either way (an empty hiddenFacetValues is a no-op AND).
  const pointVisibility = useMemo(() => {
    const colorVisibility = calcVisibility(
      data,
      hiddenLegendValues,
      continuousBins,
      plotConfig.hide_points,
      colorMode.mode,
      colorMode.target
    );

    const facetVisibility = calcVisibility(
      data,
      hiddenFacetValues,
      facetContinuousBins,
      undefined,
      facet_by,
      "facet"
    );

    if (!colorVisibility || !facetVisibility) {
      return colorVisibility;
    }

    return colorVisibility.map(
      (v: boolean, i: number) => v && facetVisibility[i]
    );
  }, [
    data,
    hiddenLegendValues,
    continuousBins,
    plotConfig.hide_points,
    colorMode,
    hiddenFacetValues,
    facetContinuousBins,
    facet_by,
  ]);

  return {
    formattedData,
    continuousBins,
    colorData,
    facetData,
    legendKeysWithNoData,
    sortedLegendKeys,
    sortedFacetKeys,
    facetContinuousBins,
    legendState,
    facetLegendState,
    colorMap,
    legendDisplayNames,
    facetDisplayNames,
    legendTitle,
    pointVisibility,
    colorTarget: colorMode.target,
    colorMatchesFacet,
  };
}
