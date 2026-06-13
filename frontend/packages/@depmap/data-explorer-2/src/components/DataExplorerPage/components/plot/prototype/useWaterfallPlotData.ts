import { useMemo } from "react";
import {
  DataExplorerPlotConfig,
  DataExplorerPlotResponse,
} from "@depmap/types";
import {
  calcBins,
  calcVisibility,
  categoryToDisplayName,
  continuousValuesToLegendKeySeries,
  ContinuousBins,
  findCategoricalSlice,
  formatDataForWaterfall,
  getColorMap,
  getLegendKeysWithNoData,
  LegendKey,
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
  colorMap: Map<LegendKey, string>;
  legendForDownload: {
    title: string;
    items: { name: string; hexColor: string }[];
  };
  pointVisibility: boolean[] | null;
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
  // Color-side sorted keys: drive legend order and (via getColorMap) the
  // colorMap iteration order, which the renderer uses for color trace
  // construction. Mode-aware via color_by so "color by expansion" picks
  // up expansion labels.
  const sortedLegendKeys = useMemo(() => {
    const catData = findCategoricalSlice(data, plotConfig.color_by);

    if (!catData || !data?.dimensions?.y) {
      return undefined;
    }

    return sortLegendKeysWaterfall(data, catData, plotConfig.sort_by) as
      | LegendKey[]
      | undefined;
  }, [data, plotConfig.color_by, plotConfig.sort_by]);

  // Group-side: drives x-position clustering in formatDataForWaterfall.
  // When group_by is unset or matches color_by, fall back to the
  // color-side outputs (no extra computation, no behavior change). When
  // they diverge, compute a separate per-point series and sorted-key
  // order from the group-side categorical slice.
  const groupMode = plotConfig.group_by ?? plotConfig.color_by;
  const groupSide = useMemo(() => {
    if (groupMode === plotConfig.color_by) {
      return { groupData: null, sortedGroupKeys: sortedLegendKeys };
    }
    const catData = findCategoricalSlice(data, groupMode);
    if (!catData || !data?.dimensions?.y) {
      return { groupData: null, sortedGroupKeys: undefined };
    }
    return {
      groupData: catData.values,
      sortedGroupKeys: sortLegendKeysWaterfall(
        data,
        catData,
        plotConfig.sort_by
      ) as LegendKey[] | undefined,
    };
  }, [data, groupMode, plotConfig.color_by, plotConfig.sort_by, sortedLegendKeys]);

  const formattedData = useMemo(
    () =>
      formatDataForWaterfall(
        data,
        plotConfig.color_by,
        groupSide.sortedGroupKeys,
        groupSide.groupData
      ),
    [data, plotConfig, groupSide]
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

    if (data?.dimensions?.color) {
      title = `${data.dimensions.color.axis_label}<br>${data.dimensions.color.dataset_label}`;
    }

    if (data?.metadata?.color_property) {
      title = data.metadata.color_property.label;
    }

    const items: { name: string; hexColor: string }[] = [];

    [...colorMap.keys()].forEach((key) => {
      if (!hiddenLegendValues.has(key)) {
        const name = categoryToDisplayName(
          key,
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

  return {
    sortedLegendKeys,
    formattedData,
    continuousBins,
    contLegendKeys,
    legendKeysWithNoData,
    legendState,
    colorMap,
    legendForDownload,
    pointVisibility,
  };
}
