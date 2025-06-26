/* eslint-disable @typescript-eslint/naming-convention */
import React, { useMemo } from "react";
import PlotControls, {
  PlotToolOptions,
} from "src/plot/components/PlotControls";
import PlotSpinner from "src/plot/components/PlotSpinner";
import ExtendedPlotType from "src/plot/models/ExtendedPlotType";
import styles from "../CompoundDoseViability.scss";
import PrototypeBrushableHeatmap from "src/doseViabilityPrototype/components/PrototypeBrushableHeatmap";
import { HeatmapFormattedData } from "../types";

interface HeatmapPlotSectionProps {
  isLoading: boolean;
  showUnselectedLines: boolean;
  compoundName: string;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData;
  doseMin: number | null;
  doseMax: number | null;
  selectedModelIds: Set<string>;
  handleSetSelectedPlotModels: (models: Set<string>) => void;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
  displayNameModelIdMap: Map<string, string>;
  visibleZIndexes: number[];
}
function HeatmapPlotSection({
  isLoading,
  compoundName,
  heatmapFormattedData,
  doseMin,
  doseMax,
  selectedModelIds,
  handleSetSelectedPlotModels,
  handleSetPlotElement,
  plotElement,
  displayNameModelIdMap,
  visibleZIndexes,
  showUnselectedLines,
}: HeatmapPlotSectionProps) {
  // Sort heatmapFormattedData by viability (mean of z values for each model/column)
  const sortedHeatmapFormattedData = useMemo(() => {
    if (!heatmapFormattedData) {
      return heatmapFormattedData;
    }
    const { modelIds, x, z } = heatmapFormattedData;
    // Compute mean viability for each model (column)
    const means = modelIds.map((_, colIdx) => {
      // For each column, get all z values (one per dose)
      const values = z
        .map((row) => row[colIdx])
        .filter((v) => v !== null && v !== undefined);
      if (values.length === 0) return Infinity;
      const sum = values.reduce(
        (acc, v) => acc + (typeof v === "number" ? v : 0),
        0
      );
      return sum / values.length;
    });
    // Get sorted indices by mean viability ascending
    const sortedIndices = means
      .map((mean, idx) => ({ mean, idx }))
      .sort((a, b) => a.mean - b.mean)
      .map((obj) => obj.idx);
    // Reorder modelIds, x, and each row of z
    return {
      ...heatmapFormattedData,
      modelIds: sortedIndices.map((i) => modelIds[i]),
      x: sortedIndices.map((i) => x[i]),
      z: z.map((row) => sortedIndices.map((i) => row[i])),
    };
  }, [heatmapFormattedData]);

  // Compute visible indices based on sorted columns
  const visibleSortedModelIdIndices = useMemo(() => {
    if (!sortedHeatmapFormattedData) return [];
    if (!showUnselectedLines && selectedModelIds && selectedModelIds.size > 0) {
      return sortedHeatmapFormattedData.modelIds
        .map((id, idx) => (selectedModelIds.has(id) ? idx : -1))
        .filter((idx) => idx !== -1);
    }
    return sortedHeatmapFormattedData.modelIds.map((_, idx) => idx);
  }, [sortedHeatmapFormattedData, selectedModelIds, showUnselectedLines]);

  // Mask sortedHeatmapFormattedData based on visibleSortedModelIdIndices and visibleZIndexes (do not filter out, just mask with nulls)
  const maskedHeatmapData = useMemo(() => {
    if (!sortedHeatmapFormattedData) return sortedHeatmapFormattedData;

    // Mask z: for each row, if rowIdx not in visibleZIndexes, mask entire row with nulls;
    // for each col, if colIdx not in visibleSortedModelIdIndices, mask with null
    const maskedZ = sortedHeatmapFormattedData.z.map((row, rowIdx) => {
      if (!visibleZIndexes.includes(rowIdx)) {
        return row.map(() => null);
      }
      return row.map((val, colIdx) =>
        visibleSortedModelIdIndices.includes(colIdx) ? val : null
      );
    });
    return {
      ...sortedHeatmapFormattedData,
      z: maskedZ,
    };
  }, [
    sortedHeatmapFormattedData,
    visibleSortedModelIdIndices,
    visibleZIndexes,
  ]);

  // Use sortedHeatmapFormattedData for selectedColumns
  const selectedColumns = useMemo(() => {
    const out = new Set<number>();

    maskedHeatmapData?.modelIds.forEach((id, index) => {
      if (id !== null && selectedModelIds.has(id)) {
        out.add(index);
      }
    });

    return out;
  }, [selectedModelIds, maskedHeatmapData]);

  // Use maskedHeatmapData for searchOptions, skipping null modelIds
  const searchOptions = useMemo(
    () =>
      maskedHeatmapData
        ? maskedHeatmapData.modelIds
            .map((modelId, index) =>
              modelId
                ? {
                    label: displayNameModelIdMap.get(modelId) || modelId,
                    stringId: modelId,
                    value: index,
                  }
                : null
            )
            .filter((opt) => opt !== null)
        : null,
    [maskedHeatmapData, displayNameModelIdMap]
  );

  // Use to hide hover text when the Heatmap is using showUnselectedLines = False
  const customdata = useMemo(() => {
    if (!maskedHeatmapData) return undefined;
    const { x, y, z } = maskedHeatmapData;
    return z.map((row, rowIdx) =>
      row.map((val, colIdx) => {
        if (val === null || val === undefined || Number.isNaN(val)) {
          return "";
        }
        // Format hover text for this cell
        return [
          `Cell line: ${x[colIdx]}`,
          `Dose: ${y[rowIdx]} µM`,
          `Viability: ${val.toFixed(3)}`,
        ].join("<br>");
      })
    );
  }, [maskedHeatmapData]);

  // HACK: so that Plotly will resize the plot when the user switches to this tab.
  // Without this hack, if the plot loads while this tab is inactive, Plotly does not
  // properly calculate plot size, and this can cause the plot to drastically overflow its bounds.
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    const handler = () => setKey((k) => k + 1);
    window.addEventListener("changeTab:heatmap", handler);
    return () => window.removeEventListener("changeTab:heatmap", handler);
  }, []);

  return (
    <div className={styles.PlotSection} key={key}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[PlotToolOptions.Search, PlotToolOptions.Download]}
            searchOptions={searchOptions}
            searchPlaceholder="Search for a cell line"
            onSearch={(selection: {
              label: string;
              value: number;
              stringId?: string;
            }) => {
              if (selection.stringId) {
                handleSetSelectedPlotModels(new Set([selection.stringId]));
              }
            }}
            downloadImageOptions={{
              filename: `dose-viability-heatmap-${compoundName}`,
              width: 800,
              height: 600,
            }}
            onDownload={() => {
              /* do nothing */
            }}
            altContainerStyle={{
              backgroundColor: "#7B8CB2",
            }}
            hideCSVDownload
          />
        )}
      </div>
      <div className={styles.plotArea}>
        {(!plotElement || isLoading) && (
          <div className={styles.plotSpinnerContainer}>
            <PlotSpinner height="100%" />
          </div>
        )}
        {maskedHeatmapData && doseMin && doseMax && !isLoading && (
          <div className={styles.heatmapContainer}>
            <PrototypeBrushableHeatmap
              data={{
                ...maskedHeatmapData,
                x: maskedHeatmapData.x,
                y: maskedHeatmapData.y,
                z: maskedHeatmapData.z,
                customdata, // Pass customdata for per-cell hover masking
              }}
              onLoad={handleSetPlotElement}
              xAxisTitle="Cell Lines"
              yAxisTitle={`${compoundName} Dose (μM)`}
              legendTitle="Viability"
              // Use per-cell hovertemplate: show %{customdata.hover} (blank for masked)
              hovertemplate="%{customdata}<extra></extra>"
              selectedColumns={selectedColumns}
              onClearSelection={() => handleSetSelectedPlotModels(new Set())}
              onSelectColumnRange={(start, end, shiftKey) => {
                let next: Set<string>;
                if (shiftKey) {
                  next = new Set(selectedModelIds);
                } else {
                  next = new Set();
                }
                for (let i = start; i <= end; i += 1) {
                  if (maskedHeatmapData.modelIds[i]) {
                    next.add(maskedHeatmapData.modelIds[i]!);
                  }
                }
                handleSetSelectedPlotModels(next);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(HeatmapPlotSection);
