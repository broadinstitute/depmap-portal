import { useMemo } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  calcBins,
  calcDensityStats,
  calcVisibility,
  categoryToDisplayName,
  ContinuousBins,
  formatDataForScatterPlot,
  getColorMap,
  LegendKey,
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
  // groupData: drives violin-track assignment. Sourced from group_by, or
  // color_by when group_by is unset. Equal-by-reference to colorData when
  // the modes match — the common case.
  groupData: unknown;
  legendKeysWithNoData: Set<LegendKey> | null;
  // sortedLegendKeys: order of legend entries (color side).
  sortedLegendKeys: LegendKey[] | undefined;
  // sortedGroupKeys: order of violin tracks (group side). Same array as
  // sortedLegendKeys when modes match.
  sortedGroupKeys: LegendKey[] | undefined;
  legendState: ReturnType<typeof useLegendState>;
  colorMap: Map<LegendKey, string>;
  legendDisplayNames: Partial<Record<LegendKey, string>>;
  legendTitle: string;
  pointVisibility: boolean[] | null;
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
  const formattedData = useMemo(
    () => formatDataForScatterPlot(data, plotConfig.color_by),
    [data, plotConfig.color_by]
  );

  const continuousBins: ContinuousBins = useMemo(
    () =>
      formattedData?.contColorData
        ? calcBins(formattedData.contColorData)
        : null,
    [formattedData]
  );

  const { sort_by, color_by, group_by, expand_by } = plotConfig;

  const {
    colorData,
    groupData,
    unusedKeys: legendKeysWithNoData,
    sortedColorKeys: sortedLegendKeys,
    sortedGroupKeys,
  } = useMemo(
    () =>
      calcDensityStats(
        data,
        continuousBins,
        sort_by,
        color_by,
        group_by,
        Boolean(expand_by?.length)
      ),
    [data, continuousBins, sort_by, color_by, group_by, expand_by]
  );

  const legendState = useLegendState(plotConfig, legendKeysWithNoData);
  const { hiddenLegendValues } = legendState;

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
      const name = categoryToDisplayName(key, data, continuousBins);
      out[key] = typeof name === "string" ? name : `${name[0]} – ${name[1]}`;
    });

    return out;
  }, [colorMap, data, continuousBins]);

  let legendTitle = "";

  if (data?.dimensions?.color) {
    legendTitle = `${data.dimensions.color.axis_label}<br>${data.dimensions.color.dataset_label}`;
  }

  if (data?.metadata?.color_property) {
    legendTitle = data.metadata.color_property.label;

    if (data.metadata.dataset_label) {
      legendTitle += `<br>${data.metadata.dataset_label}`;
    }
  }

  const pointVisibility = useMemo(
    () =>
      calcVisibility(
        data,
        hiddenLegendValues,
        continuousBins,
        plotConfig.hide_points,
        plotConfig.color_by
      ),
    [data, hiddenLegendValues, continuousBins, plotConfig.hide_points, plotConfig.color_by]
  );

  return {
    formattedData,
    continuousBins,
    colorData,
    groupData,
    legendKeysWithNoData,
    sortedLegendKeys,
    sortedGroupKeys,
    legendState,
    colorMap,
    legendDisplayNames,
    legendTitle,
    pointVisibility,
  };
}
