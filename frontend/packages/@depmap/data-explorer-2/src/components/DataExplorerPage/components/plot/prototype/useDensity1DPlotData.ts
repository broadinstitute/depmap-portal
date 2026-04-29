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
  colorData: unknown;
  legendKeysWithNoData: Set<LegendKey> | null;
  sortedLegendKeys: LegendKey[] | undefined;
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

  const { sort_by } = plotConfig;

  const [colorData, legendKeysWithNoData, sortedLegendKeys] = useMemo(
    () => calcDensityStats(data, continuousBins, sort_by),
    [data, continuousBins, sort_by]
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
        plotConfig.hide_points
      ),
    [data, hiddenLegendValues, continuousBins, plotConfig.hide_points]
  );

  return {
    formattedData,
    continuousBins,
    colorData,
    legendKeysWithNoData,
    sortedLegendKeys,
    legendState,
    colorMap,
    legendDisplayNames,
    legendTitle,
    pointVisibility,
  };
}
