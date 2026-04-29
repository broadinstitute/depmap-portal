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
  palette: Palette
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
    () => getLegendKeysWithNoData(data, continuousBins),
    [data, continuousBins]
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
    () => calcVisibility(data, hiddenLegendValues, continuousBins),
    [data, hiddenLegendValues, continuousBins]
  );

  const regressionLines = useMemo(() => {
    if (!linreg_by_group || !hiddenLegendValues) {
      return null;
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
    hiddenLegendValues,
    linreg_by_group,
    palette,
    plotConfig.show_regression_line,
  ]);

  const showIdentityLine = Boolean(
    data?.dimensions?.x &&
      data?.dimensions?.y &&
      data.dimensions.x.dataset_id === data.dimensions.y.dataset_id &&
      !plotConfig.hide_identity_line
  );

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
    showIdentityLine,
  };
}
