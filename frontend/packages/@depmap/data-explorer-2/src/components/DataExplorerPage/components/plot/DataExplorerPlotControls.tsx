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

    // Expanded plots are N×M (entity, member) pairs, so index_ids/index_labels
    // repeat each index entity once per member. One option per point would list
    // the same model many times and a click would land on an arbitrary
    // (entity, member) point. Instead, de-dupe to one option per index entity
    // (searchable by name or id) and let handleSearch select that entity across
    // all its members.
    if (data.expansions?.length) {
      const indicesByEntity = new Map<string, number[]>();

      for (let i = 0; i < data.index_ids.length; i += 1) {
        const id = data.index_ids[i];
        const list = indicesByEntity.get(id);

        if (list) {
          list.push(i);
        } else {
          indicesByEntity.set(id, [i]);
        }
      }

      const hasPlottablePoint = (indices: number[]) =>
        indices.some(
          (i) =>
            data.dimensions.x.values[i] !== null &&
            (!data.dimensions.y || data.dimensions.y.values[i] !== null)
        );

      const nameOptions: { value: string; label: string }[] = [];
      const idOptions: { value: string; label: string }[] = [];

      indicesByEntity.forEach((indices, id) => {
        if (!hasPlottablePoint(indices)) {
          return;
        }

        nameOptions.push({
          label: data.index_labels[indices[0]],
          value: `expansion_entity:${id}`,
        });

        if (data.index_type === "depmap_model") {
          idOptions.push({ label: id, value: `expansion_entity:${id}` });
        }
      });

      // Names first (the human-friendly default), then IDs as a secondary
      // search path — mirrors the non-expanded ordering below.
      return [...nameOptions, ...idOptions];
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
      // Expanded plots de-dupe search to one entry per index entity; selecting
      // it selects that entity across all its members (every (entity, member)
      // point), accumulating via the existing single-point click.
      if (selected.value.startsWith("expansion_entity:")) {
        const id = selected.value.slice("expansion_entity:".length);
        const indices: number[] = [];

        for (let i = 0; i < data.index_ids.length; i += 1) {
          if (data.index_ids[i] === id) {
            indices.push(i);
          }
        }

        indices.forEach((i) => handleClickPoint(i, true));

        if (indices.length > 0 && !plotElement.isPointInView(indices[0])) {
          setTimeout(() => plotElement.resetZoom(), 0);
        }

        return;
      }

      const pointIndex = Number(selected.value.split(":")[1]);
      handleClickPoint(pointIndex, true);

      if (!plotElement.isPointInView(pointIndex)) {
        setTimeout(() => plotElement.resetZoom(), 0);
      }
    },
    [data, plotElement, handleClickPoint]
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
