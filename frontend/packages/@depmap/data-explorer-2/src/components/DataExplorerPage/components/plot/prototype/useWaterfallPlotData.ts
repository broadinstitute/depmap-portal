import { useMemo } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  calcBins,
  calcVisibility,
  categoryToDisplayName,
  computeContinuousLegendKeySeries,
  computeCustomFilterSeries,
  continuousValuesToLegendKeySeries,
  ContinuousBins,
  findCategoricalSlice,
  findContinuousColorSlice,
  formatCategoryLabel,
  formatDataForWaterfall,
  getColorMap,
  getLegendKeysWithNoData,
  LEGEND_OTHER,
  LegendKey,
  nullifyUnplottableValues,
  resolveColorMode,
  sortLegendKeysWaterfall,
  useLegendState,
} from "./plotUtils";

type Palette = Parameters<typeof getColorMap>[2];

export interface WaterfallPlotData {
  sortedLegendKeys: LegendKey[] | undefined;
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
  contLegendKeys: LegendKey[] | null;
  legendKeysWithNoData: Set<LegendKey> | null;
  legendState: ReturnType<typeof useLegendState>;
  // Drives the "Facets" panel (shown only when color_by/facet_by diverge —
  // see resolveColorMode) — a second, independent useLegendState instance
  // pinned to target "facet".
  facetLegendState: ReturnType<typeof useLegendState>;
  // facetDisplayNames: labels for facetSide.sortedFacetKeys, built from
  // facet's own continuous bins — mirrors useDensity1DPlotData's identically
  // named/purposed field.
  facetDisplayNames: Partial<Record<LegendKey, string>>;
  // sortedFacetKeys: order of x-clusters (facet side) — feeds the Facets
  // panel's display list.
  sortedFacetKeys: LegendKey[] | undefined;
  // facetContinuousBins: facet's own bins, independent of continuousBins
  // (color's own) — needed by the Facets panel to label a continuous
  // facet's LEGEND_RANGE_* keys via categoryToDisplayName.
  facetContinuousBins: ContinuousBins;
  colorMap: Map<LegendKey, string>;
  legendForDownload: {
    title: string;
    items: { name: string; hexColor: string }[];
  };
  pointVisibility: boolean[] | null;
  // Contiguous x-rank regions, one per facet, with gap-midpoint boundaries
  // (±Infinity at the ends). Drives enforceSingleFacetSelection in the
  // waterfall's scatter renderer. Null when there's nothing to constrain.
  selectionRegions: { key: string | symbol; lo: number; hi: number }[] | null;
  // Which triad (color's own, or facet's own via the version-2 default
  // defer) actually backs the legend — PlotLegend/LegendLabel need this to
  // read the right filters.color1/2 vs facet1/2 pair for a LEGEND_BOTH
  // label. See resolveColorMode.
  colorTarget: "color" | "facet";
  // Whether facet_by has real backing (drives x-clustering) — threaded
  // into PrototypeScatterPlot so it can render a neutral inert color
  // instead of palette.all when color_by has nothing of its own to show.
  // See PrototypeScatterPlot's own hasFacetOptionsEnabled prop.
  hasFacetOptionsEnabled: boolean;
  // Whether facet_by and color_by resolve to the SAME underlying source —
  // true whenever colorTarget is "facet" (color defers to facet_by), but
  // ALSO true when both explicitly name the same real source without either
  // deferring (e.g. facet_by/color_by both "expansion", or both the
  // identical property). Mirrors useDensity1DPlotData's identically-named
  // field — see its comment for the full rationale. Used to gate the
  // "Facets" panel: when true, Legend already IS the facet partition, so a
  // second panel would be redundant.
  colorMatchesFacet: boolean;
}

// Encapsulates the data-prep pipeline shared by DataExplorerWaterfallPlot and
// any embedded/standalone waterfall consumer. Parallel to useScatterPlotData,
// but with waterfall-specific differences: an upfront `sortedLegendKeys`
// computation that's threaded into both the formatter and `getColorMap`, no
// regression lines, and no identity line.
export default function useWaterfallPlotData(
  data: DataExplorerPlotResponse | null,
  plotConfig: DataExplorerPlotConfig,
  palette: Palette
): WaterfallPlotData {
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

  // Color-side sorted keys: drive legend order and (via getColorMap) the
  // colorMap iteration order, which the renderer uses for color trace
  // construction. Mode-aware via the resolved color mode so "color by
  // expansion" (or "color by facet, itself expansion") picks up expansion
  // labels.
  const sortedLegendKeys = useMemo(() => {
    const catData = findCategoricalSlice(
      data,
      colorMode.mode,
      colorMode.target
    );

    if (!catData || !data?.dimensions?.y) {
      return undefined;
    }

    return sortLegendKeysWaterfall(data, catData, plotConfig.sort_by) as
      | LegendKey[]
      | undefined;
  }, [data, colorMode, plotConfig.sort_by]);

  // Facet's OWN continuous bins, computed independently of color's — facet
  // and color can each independently resolve to a continuous property, and
  // sharing bins between them would either silently be null (color not
  // continuous) or apply the wrong boundaries (a different continuous
  // slice). Mirrors calcDensityStats's `facetContinuousBins`.
  // Nullified the same way formatDataForWaterfall/formatDataForScatterPlot
  // nullify color's own contValues so facet's bin edges match color's when
  // both resolve to the same underlying property (otherwise the two would
  // compute min/max over different-sized value sets and produce slightly
  // different buckets).
  const facetContinuousBins: ContinuousBins = useMemo(() => {
    const values = nullifyUnplottableValues(
      findContinuousColorSlice(data, "facet")?.values,
      data?.filters?.visible?.values,
      data ? [data.dimensions.x, data.dimensions.y!] : undefined
    );
    return values ? calcBins(values) : null;
  }, [data]);

  // "J4"-style comparison (mirrors useDensity1DPlotData/regressionLinesByFacet
  // in useScatterPlotData.ts): facet_by and color_by can independently
  // resolve to the SAME underlying source even when color_by doesn't
  // literally defer to facet_by via the "facet" sentinel.
  const colorMatchesFacet = useMemo(() => {
    if (colorMode.target === "facet") {
      return true;
    }

    const facetSource =
      findCategoricalSlice(data, plotConfig.facet_by, "facet") ??
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
  }, [data, plotConfig.facet_by, colorMode]);

  // Facet-side: drives x-position clustering in formatDataForWaterfall.
  // facet_by is a fully independent axis from color_by — it does NOT fall
  // back to color_by when unset. An unset facet_by means no clustering at
  // all (formatDataForWaterfall's plain rank-sort), not "cluster by color".
  const facetSide = useMemo(() => {
    if (!plotConfig.facet_by || !data?.dimensions?.y) {
      return { facetData: null, sortedFacetKeys: undefined };
    }

    const catData = findCategoricalSlice(data, plotConfig.facet_by, "facet");
    if (catData) {
      return {
        facetData: catData.values,
        sortedFacetKeys: sortLegendKeysWaterfall(
          data,
          catData,
          plotConfig.sort_by
        ) as LegendKey[] | undefined,
      };
    }

    // Continuous fallback: facet's own property may not be categorical at
    // all (e.g. a numeric annotation) — bin it independently of color's
    // own continuous binning. Natural bin order already is "sorted by
    // value ascending", so sort_by isn't consulted here (see
    // computeContinuousLegendKeySeries).
    const contData = findContinuousColorSlice(data, "facet");
    const binned =
      contData &&
      computeContinuousLegendKeySeries(
        contData.values,
        facetContinuousBins,
        data.filters?.visible?.values
      );

    if (binned) {
      return { facetData: binned.series, sortedFacetKeys: binned.sortedKeys };
    }

    // Custom-filter fallback: facet_by "raw_slice"/"aggregated_slice" backed
    // by filters.facet1/facet2, mirroring color_by's own custom-filter
    // partition (see computeCustomFilterSeries) — a facet per selected
    // context, an automatic "Other" cluster for points in neither, and a
    // "Both" cluster for the overlap.
    const { facet1, facet2 } = data.filters ?? {};
    if (facet1 || facet2) {
      const custom = computeCustomFilterSeries(
        facet1,
        facet2,
        data.filters?.visible
      );
      return {
        facetData: custom.series,
        sortedFacetKeys: custom.sortedKeys as LegendKey[],
      };
    }

    return { facetData: null, sortedFacetKeys: undefined };
  }, [data, plotConfig.facet_by, plotConfig.sort_by, facetContinuousBins]);

  const formattedData = useMemo(
    () =>
      formatDataForWaterfall(
        data,
        colorMode.mode,
        facetSide.sortedFacetKeys,
        facetSide.facetData,
        colorMode.target
      ),
    [data, colorMode, facetSide]
  );

  const continuousBins: ContinuousBins = useMemo(
    () =>
      formattedData?.contColorData
        ? calcBins(formattedData.contColorData)
        : null,
    [formattedData]
  );

  const [contLegendKeys] = useMemo(
    () =>
      formattedData?.contColorData
        ? continuousValuesToLegendKeySeries(
            formattedData.contColorData,
            continuousBins
          )
        : [null],
    [continuousBins, formattedData]
  );

  const legendKeysWithNoData = useMemo(
    () =>
      getLegendKeysWithNoData(
        data,
        continuousBins,
        colorMode.mode,
        colorMode.target
      ),
    [data, continuousBins, colorMode]
  );

  const legendState = useLegendState(plotConfig, legendKeysWithNoData);
  const { hiddenLegendValues } = legendState;

  // Facet's own no-data keys, computed against facet's own triad and bins —
  // the exact facet-side analog of legendKeysWithNoData above.
  const facetKeysWithNoData = useMemo(
    () =>
      getLegendKeysWithNoData(
        data,
        facetContinuousBins,
        plotConfig.facet_by,
        "facet"
      ),
    [data, facetContinuousBins, plotConfig.facet_by]
  );

  // Independent of the color legend's own hidden set — drives the "Facets"
  // panel. See useDensity1DPlotData's identically-purposed facetLegendState.
  // Seeded with facet's own no-data keys so facets with nothing to plot
  // start toggled off, mirroring the color legend's own seeding above.
  const facetLegendState = useLegendState(
    plotConfig,
    facetKeysWithNoData,
    "facet"
  );
  const { hiddenLegendValues: hiddenFacetValues } = facetLegendState;

  // Mirrors useDensity1DPlotData's facetDisplayNames.
  const facetDisplayNames = useMemo(() => {
    const out: Partial<Record<LegendKey, string>> = {};

    if (!data || !facetSide.sortedFacetKeys) {
      return out;
    }

    facetSide.sortedFacetKeys.forEach((key) => {
      out[key] = formatCategoryLabel(key, data, facetContinuousBins, "facet");
    });

    return out;
  }, [data, facetSide.sortedFacetKeys, facetContinuousBins]);

  const colorMap = useMemo(
    () => getColorMap(data, plotConfig, palette, sortedLegendKeys),
    [data, plotConfig, palette, sortedLegendKeys]
  );

  // The plot only needs legend info if the user is downloading an image of it.
  // NOTE: Unlike the scatter variant, this does NOT append `dataset_label` to
  // the title when `color_property` is set. Preserving existing behavior; may
  // be worth revisiting whether that's intentional.
  const legendForDownload = useMemo(() => {
    let title = "";

    // dataset_label is legitimately absent for "primary" metadata datasets
    // (see isPrimaryMetatadata in breadboxMethods.ts) — must be appended
    // conditionally, not interpolated unconditionally, or a real `undefined`
    // bakes into the string as the literal text "undefined". Mirrors
    // PlotLegend.tsx's SliceDescription, which already gets this right.
    const legendDim = data?.dimensions?.[colorMode.target];
    if (legendDim) {
      title = legendDim.dataset_label
        ? `${legendDim.axis_label}<br>${legendDim.dataset_label}`
        : legendDim.axis_label;
    }

    const legendProperty = data?.metadata?.[`${colorMode.target}_property`];
    if (legendProperty) {
      title = legendProperty.label;

      if (legendProperty.dataset_label) {
        title += `<br>${legendProperty.dataset_label}`;
      }
    }

    const items: { name: string; hexColor: string }[] = [];

    [...colorMap.keys()].forEach((key) => {
      if (!hiddenLegendValues.has(key)) {
        const name = categoryToDisplayName(
          key,
          data as DataExplorerPlotResponse,
          continuousBins,
          colorMode.target
        );
        const formattedName =
          typeof name === "string" ? name : `${name[0]} – ${name[1]}`;

        items.push({
          name: formattedName,
          hexColor: colorMap.get(key)!,
        });
      }
    });

    return {
      title,
      items,
    };
  }, [colorMap, data, continuousBins, hiddenLegendValues, colorMode]);

  // A point hidden by EITHER axis (color-legend toggle or facet toggle) is
  // hidden — see useDensity1DPlotData's identical combination for rationale.
  const pointVisibility = useMemo(() => {
    const colorVisibility = calcVisibility(
      data,
      hiddenLegendValues,
      continuousBins,
      undefined,
      colorMode.mode,
      colorMode.target
    );

    const facetVisibility = calcVisibility(
      data,
      hiddenFacetValues,
      facetContinuousBins,
      undefined,
      plotConfig.facet_by,
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
    colorMode,
    hiddenFacetValues,
    facetContinuousBins,
    plotConfig.facet_by,
  ]);

  // Build the per-facet x-rank regions that enforceSingleFacetSelection clamps
  // to. Each facet's region spans from its leftmost to its rightmost assigned
  // rank; boundaries between adjacent facets are the gap midpoints, with
  // ±Infinity at the two ends. Mirrors how formatDataForWaterfall buckets
  // points (facet-side series, falling back to the color-side categorical), and
  // only counts points that received an x (i.e. visible points). Null when
  // there are fewer than two facets to constrain across.
  const selectionRegions = useMemo(() => {
    const x = formattedData?.x;
    const groupSeries = (facetSide.facetData ?? formattedData?.catColorData) as
      | (string | number | symbol | null)[]
      | null;
    if (!x || !groupSeries) {
      return null;
    }

    const extents = new Map<string | symbol, { min: number; max: number }>();
    for (let i = 0; i < x.length; i += 1) {
      const xv = x[i];
      if (typeof xv !== "number" || !Number.isFinite(xv)) {
        continue;
      }
      const key = (groupSeries[i] || LEGEND_OTHER) as string | symbol;
      const e = extents.get(key) ?? { min: Infinity, max: -Infinity };
      if (xv < e.min) e.min = xv;
      if (xv > e.max) e.max = xv;
      extents.set(key, e);
    }

    if (extents.size < 2) {
      return null;
    }

    const ordered = [...extents.entries()].sort((a, b) => a[1].min - b[1].min);
    return ordered.map(([key, e], i) => ({
      key,
      lo: i === 0 ? -Infinity : (ordered[i - 1][1].max + e.min) / 2,
      hi:
        i === ordered.length - 1
          ? Infinity
          : (e.max + ordered[i + 1][1].min) / 2,
    }));
  }, [formattedData, facetSide]);

  return {
    sortedLegendKeys,
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    facetLegendState,
    facetDisplayNames,
    sortedFacetKeys: facetSide.sortedFacetKeys,
    facetContinuousBins,
    colorMap,
    legendForDownload,
    pointVisibility,
    selectionRegions,
    colorTarget: colorMode.target,
    hasFacetOptionsEnabled: Boolean(facetSide.facetData),
    colorMatchesFacet,
  };
}
