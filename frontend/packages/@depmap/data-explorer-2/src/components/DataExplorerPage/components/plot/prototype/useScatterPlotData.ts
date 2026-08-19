import { useMemo } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
  LinRegInfo,
} from "@depmap/types";
import {
  calcBins,
  calcVisibility,
  categoryToDisplayName,
  computeFacets,
  continuousValuesToLegendKeySeries,
  ContinuousBins,
  facetMaskFor,
  findCategoricalSlice,
  findContinuousColorSlice,
  formatDataForScatterPlot,
  getColorMap,
  getLegendKeysWithNoData,
  LEGEND_ALL,
  LEGEND_BOTH,
  LEGEND_NEITHER,
  LEGEND_OTHER,
  LegendKey,
  nullifyUnplottableValues,
  RegressionLine,
  resolveColorMode,
  useLegendState,
} from "./plotUtils";
import { linregress } from "@depmap/statistics";

type Palette = Parameters<typeof getColorMap>[2];

export interface ScatterPlotData {
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
  // pinned to target "facet". The display list itself (facetOrder) is
  // computed in DataExplorerScatterPlot.tsx, where computeFacets already
  // runs for the small-multiples grid.
  facetLegendState: ReturnType<typeof useLegendState>;
  colorMap: Map<LegendKey, string>;
  legendForDownload: {
    title: string;
    items: { name: string; hexColor: string }[];
  };
  pointVisibility: boolean[] | null;
  regressionLines: RegressionLine[] | null;
  // Per-facet fits for the faceted renderer, keyed by facet label. null when
  // not faceted (facet_by unset); the single-panel path uses regressionLines.
  regressionLinesByFacet: Map<string, RegressionLine> | null;
  showIdentityLine: boolean;
  // Which triad (color's own, or facet's own via the version-2 default
  // defer) actually backs the legend — PlotLegend/LegendLabel need this to
  // read the right filters.color1/2 vs facet1/2 pair for a LEGEND_BOTH
  // label. See resolveColorMode.
  colorTarget: "color" | "facet";
  // Whether facet_by and color_by resolve to the SAME underlying source —
  // see colorMatchesFacet's own comment for the full rationale. Used to
  // gate the "Facets" panel: when true, Legend already IS the facet
  // partition, so a second panel would be redundant.
  colorMatchesFacet: boolean;
}

// Encapsulates the data-prep pipeline shared by DataExplorerScatterPlot and
// any embedded/standalone scatter plot consumer. Returns everything needed to
// drive PrototypeScatterPlot plus the legend state (so callers that render a
// legend UI can wire up the click handlers).
export default function useScatterPlotData(
  data: DataExplorerPlotResponse | null,
  plotConfig: DataExplorerPlotConfig,
  linreg_by_group: LinRegInfo[] | null,
  palette: Palette,
  canShowIdentityLine: boolean
): ScatterPlotData {
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

  // Facet's OWN continuous bins, computed independently of color's — mirrors
  // useDensity1DPlotData/useWaterfallPlotData's identically-named field.
  // Nullified the same way formatDataForScatterPlot nullifies color's own
  // contValues so facet's bin edges match color's when both resolve to the
  // same underlying property (otherwise the two would compute min/max over
  // different-sized value sets and produce slightly different buckets).
  const facetContinuousBins: ContinuousBins = useMemo(() => {
    const values = nullifyUnplottableValues(
      findContinuousColorSlice(data, "facet")?.values,
      data?.filters?.visible?.values,
      data ? [data.dimensions.x, data.dimensions.y!] : undefined
    );
    return values ? calcBins(values) : null;
  }, [data]);

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

  const colorMap = useMemo(() => getColorMap(data, plotConfig, palette), [
    data,
    plotConfig,
    palette,
  ]);

  // The plot only needs legend info if the user is downloading an image of it.
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
          key as LegendKey,
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
  // For scatter, a hidden facet also removes its whole panel (see
  // DataExplorerScatterPlot.tsx's hiddenFacets wiring into
  // SmallMultiplesScatter) — this pointVisibility combination keeps
  // regression fits/counts consistent with that removal.
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

  const regressionLines = useMemo(() => {
    if (!hiddenLegendValues) {
      return null;
    }

    // Expanded single-panel: fetchLinearRegression is skipped when an axis
    // carries the "expansion" sentinel, so there's no linreg_by_group. When
    // ungrouped (facet_by unset), fall back to color_by's own facets — the
    // same categorical/custom-filter partition fetchLinearRegression itself
    // would use had it been reachable here — fitting one regression line
    // per category, each colored to match (reusing computeFacets'
    // facetColorKeys the same way regressionLinesByFacet does, so a "Both"/
    // "Other" fallback line gets palette.compareBoth/palette.other rather
    // than a coincidental colorMap miss). Continuous color (or color_by
    // having nothing real to facet by either) still pools into one line,
    // matching fetchLinearRegression's own behavior — it never splits by a
    // continuous color either.
    if (!linreg_by_group) {
      if (
        !plotConfig.show_regression_line ||
        plotConfig.facet_by ||
        !formattedData ||
        !plotConfig.expand_by?.length ||
        !data
      ) {
        return null;
      }

      const x = formattedData.x;
      const y = formattedData.y;
      if (!x || !y) {
        return null;
      }

      const visible = pointVisibility ?? x.map(() => true);

      const colorFacetInfo = colorMode.mode
        ? computeFacets(data, colorMode.mode, "color")
        : null;

      if (colorFacetInfo) {
        const { facetKeys, facetColorKeys } = colorFacetInfo;
        // The "N/A" bucket gets a fit too, same as any other facet —
        // see computeFacetedLinReg's comment for the reasoning.
        const facets = [...new Set(facetKeys)];

        return facets.map((facet) => {
          const inFacet = facetMaskFor(facetKeys, facet, x, y, visible);
          const fx: number[] = [];
          const fy: number[] = [];
          for (let i = 0; i < x.length; i += 1) {
            if (inFacet(i) && Number.isFinite(x[i]) && Number.isFinite(y[i])) {
              fx.push(x[i] as number);
              fy.push(y[i] as number);
            }
          }

          const { slope, intercept } = linregress(fx, fy);
          const colorKey = facetColorKeys?.[facet] ?? facet;

          return {
            hidden:
              fx.length < 3 ||
              !Number.isFinite(slope) ||
              !plotConfig.show_regression_line ||
              hiddenLegendValues.has(colorKey),
            color: colorMap.get(colorKey) || palette.other,
            m: slope,
            b: intercept,
          };
        });
      }

      const fx: number[] = [];
      const fy: number[] = [];
      for (let i = 0; i < x.length; i += 1) {
        if (visible[i] && Number.isFinite(x[i]) && Number.isFinite(y[i])) {
          fx.push(x[i] as number);
          fy.push(y[i] as number);
        }
      }

      const { slope, intercept } = linregress(fx, fy);
      return [
        {
          hidden: fx.length < 3 || !Number.isFinite(slope),
          color: palette.other,
          m: slope,
          b: intercept,
        },
      ];
    }

    return linreg_by_group.map((linreg) => {
      // HACK: `linreg.group_label` is always a string or null but, in order to
      // highlight some special cases, we temporarily set `label` a LegendKey
      // symbol below.
      let label: string | null | LegendKey = linreg.group_label;

      // FIXME: The backend should return a property to indicate this is the
      // case rather than parsing the label.
      if (typeof label === "string" && label.startsWith("Both (")) {
        label = LEGEND_BOTH;
      }

      if (label === null) {
        // A null group_label from the backend's classic (non-expansion)
        // fetchLinearRegression is ambiguous on its own — it means either
        // "in neither selected context" (raw_slice/aggregated_slice, a real
        // classification) or "missing data" (property/custom, a null
        // value), depending on which color_by mode was active when that
        // fetch ran. colorMode.mode (already a dependency of this useMemo)
        // resolves it, rather than guessing.
        const isCustomFilterMode =
          colorMode.mode === "raw_slice" ||
          colorMode.mode === "aggregated_slice";
        label =
          /* eslint-disable no-nested-ternary */
          linreg_by_group.length === 1
            ? LEGEND_ALL
            : isCustomFilterMode
            ? LEGEND_NEITHER
            : LEGEND_OTHER;
      }

      let hidden =
        linreg.number_of_points < 3 ||
        !plotConfig.show_regression_line ||
        hiddenLegendValues.has(label);

      if (
        (label === LEGEND_ALL ||
          label === LEGEND_OTHER ||
          label === LEGEND_NEITHER) &&
        (hiddenLegendValues.has(LEGEND_OTHER) ||
          hiddenLegendValues.has(LEGEND_NEITHER) ||
          hiddenLegendValues.has(LEGEND_ALL))
      ) {
        hidden = true;
      }

      if (data?.dimensions?.color && plotConfig.show_regression_line) {
        hidden = false;
      }

      if (((linreg.slope as unknown) as string) === "") {
        hidden = true;
      }

      return {
        hidden,
        color: colorMap.get(label) || palette.other,
        m: Number(linreg.slope),
        b: Number(linreg.intercept),
      };
    });
  }, [
    colorMap,
    data,
    formattedData,
    hiddenLegendValues,
    linreg_by_group,
    palette,
    plotConfig.expand_by,
    plotConfig.facet_by,
    plotConfig.show_regression_line,
    pointVisibility,
    colorMode,
  ]);

  const showIdentityLine = Boolean(
    canShowIdentityLine && !plotConfig.hide_identity_line
  );

  // "J4"-style comparison (mirrors useDensity1DPlotData's identically-named
  // field): facet_by and color_by can independently resolve to the SAME
  // underlying source even when color_by doesn't literally defer to
  // facet_by via the "facet" sentinel (e.g. both explicitly name the
  // identical property). Used both by regressionLinesByFacet below (a
  // facet's line may only borrow its color from colorMap when this is true)
  // and by the caller to gate the "Facets" panel (redundant with Legend
  // when true).
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

  // Faceted regression: one fit per facet_by facet, computed here from the
  // main response — which carries facet_by's per-point values via
  // computeFacets (including the expansion case fetchLinearRegression's
  // side-fetch can't see, and now the continuous-bin case too). Single-panel
  // keeps using linreg_by_group above. Fit over formattedData.x/y with the
  // same facet mask the renderer draws, so each line is fit over exactly its
  // panel's points.
  const regressionLinesByFacet = useMemo(() => {
    if (!plotConfig.facet_by || !data || !formattedData) {
      return null;
    }

    const facetInfo = computeFacets(data, plotConfig.facet_by);
    const x = formattedData.x;
    const y = formattedData.y;
    if (!facetInfo || !x || !y) {
      return null;
    }

    const { facetKeys, facetColorKeys } = facetInfo;
    const visible = pointVisibility ?? x.map(() => true);

    // A facet's line takes that facet's color only when facet_by resolves
    // to the SAME source as color_by (the panel is then monochromatic);
    // otherwise neutral, since a facet spanning several colors has no
    // single color to borrow. See colorMatchesFacet's own comment.

    // The "N/A" bucket gets a fit too, same as any other facet —
    // see computeFacetedLinReg's comment for the reasoning.
    const facets = [...new Set(facetKeys)];
    const lines = new Map<string, RegressionLine>();

    facets.forEach((facet) => {
      const inFacet = facetMaskFor(facetKeys, facet, x, y, visible);
      const fx: number[] = [];
      const fy: number[] = [];
      for (let i = 0; i < x.length; i += 1) {
        if (inFacet(i) && Number.isFinite(x[i]) && Number.isFinite(y[i])) {
          fx.push(x[i] as number);
          fy.push(y[i] as number);
        }
      }

      const { slope, intercept } = linregress(fx, fy);
      // facet is always the formatted display string; colorMap is keyed by
      // the original LegendKey (a shared Symbol for LEGEND_BOTH/OTHER/
      // RANGE_N facets), so a stringified facet must be translated back via
      // facetColorKeys before the lookup — looking it up directly always
      // misses and silently falls through to palette.other.
      const colorKey = facetColorKeys?.[facet] ?? facet;
      lines.set(facet, {
        m: slope,
        b: intercept,
        hidden:
          fx.length < 3 ||
          !Number.isFinite(slope) ||
          !plotConfig.show_regression_line,
        color: colorMatchesFacet
          ? colorMap.get(colorKey) || palette.other
          : "#333",
      });
    });

    return lines;
  }, [
    data,
    formattedData,
    plotConfig.facet_by,
    plotConfig.show_regression_line,
    pointVisibility,
    colorMap,
    palette,
    colorMatchesFacet,
  ]);

  return {
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    facetLegendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    regressionLinesByFacet,
    showIdentityLine,
    colorTarget: colorMode.target,
    colorMatchesFacet,
  };
}
