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
  continuousValuesToLegendKeySeries,
  ContinuousBins,
  facetMaskFor,
  findCategoricalSlice,
  formatDataForScatterPlot,
  getColorMap,
  getLegendKeysWithNoData,
  LEGEND_ALL,
  LEGEND_BOTH,
  LEGEND_OTHER,
  LegendKey,
  RegressionLine,
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
  colorMap: Map<LegendKey, string>;
  legendForDownload: {
    title: string;
    items: { name: string; hexColor: string }[];
  };
  pointVisibility: boolean[] | null;
  regressionLines: RegressionLine[] | null;
  // Per-facet fits for the faceted renderer, keyed by facet label. null when
  // not faceted (group_by unset); the single-panel path uses regressionLines.
  regressionLinesByFacet: Map<string, RegressionLine> | null;
  showIdentityLine: boolean;
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
  const formattedData = useMemo(
    () => formatDataForScatterPlot(data, plotConfig.color_by),
    [data, plotConfig]
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
    () => getLegendKeysWithNoData(data, continuousBins, plotConfig.color_by),
    [data, continuousBins, plotConfig.color_by]
  );

  const legendState = useLegendState(plotConfig, legendKeysWithNoData);
  const { hiddenLegendValues } = legendState;

  const colorMap = useMemo(() => getColorMap(data, plotConfig, palette), [
    data,
    plotConfig,
    palette,
  ]);

  // The plot only needs legend info if the user is downloading an image of it.
  const legendForDownload = useMemo(() => {
    let title = "";

    if (data?.dimensions?.color) {
      title = `${data.dimensions.color.axis_label}<br>${data.dimensions.color.dataset_label}`;
    }

    if (data?.metadata?.color_property) {
      title = data.metadata.color_property.label;

      if (data.metadata.dataset_label) {
        title += `<br>${data.metadata.dataset_label}`;
      }
    }

    const items: { name: string; hexColor: string }[] = [];

    [...colorMap.keys()].forEach((key) => {
      if (!hiddenLegendValues.has(key)) {
        const name = categoryToDisplayName(
          key as LegendKey,
          data as DataExplorerPlotResponse,
          continuousBins
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
  }, [colorMap, data, continuousBins, hiddenLegendValues]);

  const pointVisibility = useMemo(
    () =>
      calcVisibility(
        data,
        hiddenLegendValues,
        continuousBins,
        undefined,
        plotConfig.color_by
      ),
    [data, hiddenLegendValues, continuousBins, plotConfig.color_by]
  );

  const regressionLines = useMemo(() => {
    if (!hiddenLegendValues) {
      return null;
    }

    // Expanded single-panel: fetchLinearRegression is skipped when an axis
    // carries the "expansion" sentinel, so there's no linreg_by_group. When
    // ungrouped (group_by unset), fit one pooled line over all visible points
    // from the response so the overall trend still shows instead of nothing.
    if (!linreg_by_group) {
      if (
        !plotConfig.show_regression_line ||
        plotConfig.group_by ||
        !formattedData ||
        !plotConfig.expand_by?.length
      ) {
        return null;
      }

      const x = formattedData.x;
      const y = formattedData.y;
      if (!x || !y) {
        return null;
      }

      const visible = pointVisibility ?? x.map(() => true);
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
        label = linreg_by_group.length === 1 ? LEGEND_ALL : LEGEND_OTHER;
      }

      let hidden =
        linreg.number_of_points < 3 ||
        !plotConfig.show_regression_line ||
        hiddenLegendValues.has(label);

      if (
        (label === LEGEND_ALL || label === LEGEND_OTHER) &&
        (hiddenLegendValues.has(LEGEND_OTHER) ||
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
    data?.dimensions?.color,
    formattedData,
    hiddenLegendValues,
    linreg_by_group,
    palette,
    plotConfig.expand_by,
    plotConfig.group_by,
    plotConfig.show_regression_line,
    pointVisibility,
  ]);

  const showIdentityLine = Boolean(
    canShowIdentityLine && !plotConfig.hide_identity_line
  );

  // Faceted regression: one fit per group_by group, computed here from the
  // main response — which carries group_by's per-point values via
  // findCategoricalSlice (including the expansion case fetchLinearRegression's
  // side-fetch can't see). Single-panel keeps using linreg_by_group above.
  // This is the group_by ?? color_by realization; since scatter only facets on
  // a categorical group_by, the continuous-color carve-out never applies here.
  // Fit over formattedData.x/y with the same facet mask the renderer draws, so
  // each line is fit over exactly its panel's points.
  const regressionLinesByFacet = useMemo(() => {
    if (!plotConfig.group_by || !data || !formattedData) {
      return null;
    }

    const facetSlice = findCategoricalSlice(data, plotConfig.group_by);
    const x = formattedData.x;
    const y = formattedData.y;
    if (!facetSlice || !x || !y) {
      return null;
    }

    const facetKeys = facetSlice.values;
    const visible = pointVisibility ?? x.map(() => true);

    // J4: a facet's line takes that facet's color only when group_by IS
    // color_by (the panel is then monochromatic); otherwise neutral, since a
    // facet spanning several colors has no single color to borrow.
    const colorSlice = findCategoricalSlice(data, plotConfig.color_by);
    const groupIsColor =
      !!colorSlice &&
      facetSlice.label === colorSlice.label &&
      facetSlice.dataset_id === colorSlice.dataset_id;

    const facets = Array.from(
      new Set(facetKeys.filter((k): k is string => k !== null))
    );
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
      lines.set(facet, {
        m: slope,
        b: intercept,
        hidden:
          fx.length < 3 ||
          !Number.isFinite(slope) ||
          !plotConfig.show_regression_line,
        color: groupIsColor
          ? colorMap.get(facet as LegendKey) || palette.other
          : "#333",
      });
    });

    return lines;
  }, [
    data,
    formattedData,
    plotConfig.group_by,
    plotConfig.color_by,
    plotConfig.show_regression_line,
    pointVisibility,
    colorMap,
    palette,
  ]);

  return {
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendForDownload,
    pointVisibility,
    regressionLines,
    regressionLinesByFacet,
    showIdentityLine,
  };
}
