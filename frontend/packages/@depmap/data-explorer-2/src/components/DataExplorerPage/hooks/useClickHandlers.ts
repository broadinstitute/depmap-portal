import React, { useCallback } from "react";
import omit from "lodash.omit";
import {
  ContextPath,
  DataExplorerContextV2,
  DataExplorerPlotConfig,
} from "@depmap/types";
import { dataExplorerAPI } from "../../../services/dataExplorerAPI";
import { logDirectPlotChange } from "../debug";
import {
  defaultContextName,
  toRelatedPlot,
  heatmapToDensityPlot,
  plotToQueryString,
  copyXAxisToY,
  swapAxisConfigs,
} from "../utils";
import { isCompletePlot } from "../validation";

export default function useClickHandlers(
  plot: DataExplorerPlotConfig,
  setPlot: (config: DataExplorerPlotConfig) => void,
  onClickSaveAsContext: (
    context: DataExplorerContextV2,
    path: ContextPath | null
  ) => void
) {
  const handleClickSaveSelectionAsContext = async (
    dimension_type: string,
    selectedLabels: Set<string>
  ) => {
    const labels = [...selectedLabels];

    const identifiers = await dataExplorerAPI.fetchDimensionIdentifiers(
      dimension_type
    );
    const labelToIdMap = Object.fromEntries(
      identifiers.map(({ label, id }) => [label, id])
    );

    // "depmap_model" is a confusing type because its IDs were considered
    // labels by the legacy portal.
    let labelsAreDemapIds = plot.index_type === "depmap_model";

    // To add an extra layer of confusion, this plot type's index isn't
    // really a proper index.
    if (plot.plot_type === "correlation_heatmap") {
      labelsAreDemapIds = !labelsAreDemapIds;
    }

    const ids = labelsAreDemapIds
      ? labels
      : labels.map((label) => labelToIdMap[label]);

    const context = {
      name: defaultContextName(selectedLabels.size),
      dimension_type,
      expr: { in: [{ var: "given_id" }, ids] },
      vars: {},
    };

    onClickSaveAsContext(context, null);
  };

  const handleClickVisualizeSelected = useCallback(
    async (e: React.MouseEvent, selectedLabels: Set<string>) => {
      if (!isCompletePlot(plot)) {
        throw new Error("Cannot visualize an incomplete plot!");
      }

      const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey;

      const dimensionType =
        plot.plot_type === "correlation_heatmap"
          ? plot.dimensions.x!.slice_type
          : plot.index_type;

      const identifiers = await dataExplorerAPI.fetchDimensionIdentifiers(
        dimensionType
      );

      const nextPlot = toRelatedPlot(plot, selectedLabels, identifiers);
      const queryString = await plotToQueryString(nextPlot, ["task"]);

      if (isModifierPressed) {
        window.history.pushState(null, "", queryString);
        setPlot(nextPlot);
        logDirectPlotChange("handleClickVisualizeSelected", plot, nextPlot);
      } else {
        const url = `${window.location.href.split("?")[0]}${queryString}`;
        window.open(url, "_blank", "noreferrer");
      }
    },
    [plot, setPlot]
  );

  const handleClickColorByContext = useCallback(
    async (context: DataExplorerContextV2) => {
      const nextPlot = omit(
        {
          ...plot,
          color_by: "aggregated_slice" as const,
          filters: { color1: context },
          dimensions: omit(plot.dimensions, "color"),
        },
        "metadata"
      );

      const queryString = await plotToQueryString(nextPlot);
      setPlot(nextPlot);
      logDirectPlotChange("handleClickColorByContext", plot, nextPlot);
      window.history.pushState(null, "", queryString);
    },
    [plot, setPlot]
  );

  const handleClickShowDensityFallback = useCallback(async () => {
    const nextPlot = heatmapToDensityPlot(plot);
    const queryString = await plotToQueryString(nextPlot);

    setPlot(nextPlot);
    logDirectPlotChange("handleClickShowDensityFallback", plot, nextPlot);
    window.history.pushState(null, "", queryString);
  }, [plot, setPlot]);

  const handleClickCopyAxisConfig = useCallback(async () => {
    const nextPlot = copyXAxisToY(plot);
    setPlot(nextPlot);
    logDirectPlotChange("handleClickCopyAxisConfig", plot, nextPlot);

    if (isCompletePlot(plot)) {
      const queryString = await plotToQueryString(nextPlot);
      window.history.pushState(null, "", queryString);
    }
  }, [plot, setPlot]);

  const handleClickSwapAxisConfigs = useCallback(async () => {
    const nextPlot = swapAxisConfigs(plot);
    setPlot(nextPlot);
    logDirectPlotChange("handleClickSwapAxisConfigs", plot, nextPlot);

    if (isCompletePlot(plot)) {
      const queryString = await plotToQueryString(nextPlot);
      window.history.pushState(null, "", queryString);
    }
  }, [plot, setPlot]);

  return {
    handleClickSaveSelectionAsContext,
    handleClickVisualizeSelected,
    handleClickColorByContext,
    handleClickShowDensityFallback,
    handleClickCopyAxisConfig,
    handleClickSwapAxisConfigs,
  };
}
