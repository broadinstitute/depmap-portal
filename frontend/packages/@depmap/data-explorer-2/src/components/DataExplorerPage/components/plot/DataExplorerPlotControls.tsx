import React, { useCallback, useMemo } from "react";
import { downloadCsv } from "@depmap/utils";
import { getDimensionTypeLabel } from "../../../../utils/misc";
import PrototypePlotControls from "./prototype/PrototypePlotsControls";
import plotToLookupTable from "./prototype/plotToLookupTable";

function isHeatmap(
  data: any
): data is {
  index_labels: string[];
  dimensions: { x: { values: number[][] } };
} {
  return Array.isArray(data?.dimensions?.x?.values?.[0]);
}

function DataExplorerPlotControls({
  data,
  isLoading,
  plotElement,
  plotConfig,
  handleClickPoint,
  onClickUnselectAll,
  hideSelectionTools = false,
}: any) {
  const searchOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    // Search options show what a user can type to pick a point. The
    // `value` prefix is unused by `handleSearch` (which parses only the
    // index after the colon); the labels in the dropdown are what the
    // user sees and matches against. For `depmap_model` we historically
    // provide two parallel lists so users can search either by depmap ID
    // or by cell line name — that dual list is preserved here, now
    // sourced from `index_ids` and `index_labels` directly.
    let options: {
      value: string;
      label: string;
    }[] = data.index_labels.map((label: string, index: number | string) => ({
      label,
      value: `index_labels:${index}`,
    }));

    if (data.index_type === "depmap_model") {
      const idOptions = data.index_ids.map((id: string, index: number) => ({
        label: id,
        value: `index_ids:${index}`,
      }));

      // Names first (the human-friendly default), then IDs as a secondary
      // search path — matches the pre-refactor option ordering.
      options = [...options, ...idOptions];
    }

    return options.filter((option) => {
      const index = Number(option.value.split(":")[1]);

      if (data.dimensions.x.values[index] === null) {
        return false;
      }

      if (data.dimensions.y?.values[index] === null) {
        return false;
      }

      return true;
    });
  }, [data]);

  const filename = useMemo(() => {
    if (!data) {
      return null;
    }

    const axes = [data.dimensions.x?.axis_label, data.dimensions.y?.axis_label]
      .filter(Boolean)
      .join(" vs ");

    const filter = data.filters?.visible?.name;

    return [axes, filter].filter(Boolean).join(" filtered by ");
  }, [data]);

  // FIXME: Add proper support for heatmaps (including distinguished heatmaps).
  const handleDownloadCsv = useCallback(() => {
    if (!data) {
      return;
    }

    if (isHeatmap(data)) {
      const xs = data.dimensions.x.values;
      const header = ["", ...data.index_labels];
      const otherRows = data.index_labels.map((label: string, i: number) => {
        return [label, ...xs[i]];
      });

      const csv = [header, ...otherRows].join("\r\n");
      const link = document.createElement("a");
      link.href = `data:text/csv,${encodeURIComponent(csv)}`;
      link.download = (filename as string).replace("_br_", "_");
      link.click();
      return;
    }

    const { formattedData, indexColumn } = plotToLookupTable(data);

    downloadCsv(formattedData, indexColumn, filename as string);
  }, [data, filename]);

  const handleSearch = useCallback(
    (selected: { value: string; label: string }) => {
      const pointIndex = Number(selected.value.split(":")[1]);
      handleClickPoint(pointIndex, true);

      if (!plotElement.isPointInView(pointIndex)) {
        setTimeout(() => plotElement.resetZoom(), 0);
      }
    },
    [plotElement, handleClickPoint]
  );

  const searchPlaceholder = plotConfig.index_type
    ? `Search for ${getDimensionTypeLabel(plotConfig.index_type)} of interest`
    : "Search";

  return (
    <PrototypePlotControls
      plot={isLoading ? null : plotElement}
      searchOptions={
        plotConfig.plot_type !== "correlation_heatmap"
          ? searchOptions
          : undefined
      }
      hideSelectionTools={hideSelectionTools}
      searchPlaceholder={searchPlaceholder}
      onSearch={handleSearch}
      onDownload={handleDownloadCsv}
      downloadImageOptions={{
        filename: filename as string,
        width: 1280,
        height: 1000,
      }}
      onClickUnselectAll={onClickUnselectAll}
    />
  );
}

export default DataExplorerPlotControls;
