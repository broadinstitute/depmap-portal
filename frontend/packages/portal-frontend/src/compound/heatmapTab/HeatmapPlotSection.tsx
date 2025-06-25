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
  compoundName: string;
  plotElement: ExtendedPlotType | null;
  heatmapFormattedData: HeatmapFormattedData;
  doseMin: number | null;
  doseMax: number | null;
  selectedModelIds: Set<string>;
  handleSetSelectedPlotModels: (models: Set<string>) => void;
  handleSetPlotElement: (element: ExtendedPlotType | null) => void;
  displayNameModelIdMap: Map<string, string>;
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
      if (values.length === 0) return Infinity; // Put empty columns at the end
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

  // Use sortedHeatmapFormattedData for selectedColumns
  const selectedColumns = useMemo(() => {
    const out = new Set<number>();

    sortedHeatmapFormattedData?.modelIds.forEach((id, index) => {
      if (selectedModelIds.has(id)) {
        out.add(index);
      }
    });

    return out;
  }, [selectedModelIds, sortedHeatmapFormattedData]);

  // Use sortedHeatmapFormattedData for searchOptions
  const searchOptions = useMemo(
    () =>
      sortedHeatmapFormattedData
        ? sortedHeatmapFormattedData.modelIds.map(
            (modelId: string, index: number) => ({
              label: displayNameModelIdMap.get(modelId) || modelId,
              stringId: modelId,
              value: index,
            })
          )
        : null,
    [sortedHeatmapFormattedData, displayNameModelIdMap]
  );

  return (
    <div className={styles.PlotSection}>
      <div className={styles.sectionHeader}>
        {plotElement && (
          <PlotControls
            plot={plotElement}
            enabledTools={[
              PlotToolOptions.Zoom,
              PlotToolOptions.Pan,
              PlotToolOptions.Search,
              PlotToolOptions.Download,
            ]}
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
        {sortedHeatmapFormattedData && doseMin && doseMax && !isLoading && (
          <div className={styles.heatmapContainer}>
            <PrototypeBrushableHeatmap
              data={sortedHeatmapFormattedData}
              onLoad={handleSetPlotElement}
              xAxisTitle="Cell Lines"
              yAxisTitle={`${compoundName} Dose (μM)`}
              legendTitle="Viability"
              hovertemplate={[
                "Cell line: %{x}",
                "Dose: %{y} µM",
                "Viability: %{z}",
                "<extra></extra>",
              ].join("<br>")}
              selectedColumns={selectedColumns}
              onClearSelection={() => handleSetSelectedPlotModels(new Set())}
              onSelectColumnRange={(
                start: number,
                end: number,
                shiftKey: boolean
              ) => {
                let next: Set<string>;
                if (shiftKey) {
                  next = new Set(selectedModelIds);
                } else {
                  next = new Set();
                }
                for (let i = start; i <= end; i += 1) {
                  next.add(sortedHeatmapFormattedData.modelIds[i]);
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
