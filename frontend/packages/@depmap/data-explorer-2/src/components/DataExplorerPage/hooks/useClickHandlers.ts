import React, { useCallback } from "react";
import omit from "lodash.omit";
import {
  ContextPath,
  DataExplorerContext,
  DataExplorerPlotConfig,
} from "@depmap/types";
import { isBreadboxOnlyMode } from "../../../isBreadboxOnlyMode";
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
    context: DataExplorerContext,
    path: ContextPath | null
  ) => void
) {
  const handleClickSaveSelectionAsContext = (
    context_type: string,
    selectedLabels: Set<string>
  ) => {
    const labels = [...selectedLabels];

    const context = isBreadboxOnlyMode
      ? {
          name: defaultContextName(selectedLabels.size),
          dimension_type: context_type,
          expr: { in: [{ var: "given_id" }, labels] },
        }
      : {
          name: defaultContextName(selectedLabels.size),
          context_type,
          expr: { in: [{ var: "entity_label" }, labels] },
        };

    onClickSaveAsContext(context as DataExplorerContext, null);
  };

  const handleClickVisualizeSelected = useCallback(
    async (e: React.MouseEvent, selectedLabels: Set<string>) => {
      if (!isCompletePlot(plot)) {
        throw new Error("Cannot visualize an incomplete plot!");
      }

      const isModifierPressed = e.shiftKey || e.ctrlKey || e.metaKey;
      let identifiers: { id: string; label: string }[] = [];

      if (isBreadboxOnlyMode) {
        const dimensionType =
          plot.plot_type === "correlation_heatmap"
            ? plot.dimensions.x!.slice_type
            : plot.index_type;

        identifiers = await dataExplorerAPI.fetchDimensionIdentifiers(
          dimensionType
        );
      }

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
    async (context: DataExplorerContext) => {
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
